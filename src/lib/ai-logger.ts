import { db } from "../db/client.js";
import type { Message, MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

const MODEL_PRICING: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  "claude-opus-4-7":            { input: 15.00,  output: 75.00,  cache_read: 1.50,  cache_write: 3.75 },
  "claude-sonnet-4-6":          { input: 3.00,   output: 15.00,  cache_read: 0.30,  cache_write: 3.75 },
  "claude-haiku-4-5-20251001":  { input: 0.80,   output: 4.00,   cache_read: 0.08,  cache_write: 1.00 },
};

// Google Places API (New) — cost is per-request based on highest-tier field requested
export const GOOGLE_PLACES_COST = {
  search: 0.04,  // Advanced tier (nationalPhoneNumber, rating, userRatingCount)
  detail: 0.04,  // Advanced tier (same + hours, reviews, addressComponents)
} as const;

const MAX_MESSAGES_BYTES = 100_000;

function cacheTokens(usage: Message["usage"]) {
  const u = usage as unknown as Record<string, unknown>;
  return {
    read:  (u["cache_read_input_tokens"]  as number | null) ?? 0,
    write: (u["cache_creation_input_tokens"] as number | null) ?? 0,
  };
}

function calcCost(model: string, usage: Message["usage"]): number {
  const p = MODEL_PRICING[model];
  if (!p) {
    console.warn({ model }, "ai-logger: no pricing for model, recording cost_usd=0");
    return 0;
  }
  const { read, write } = cacheTokens(usage);
  return (
    usage.input_tokens * p.input +
    usage.output_tokens * p.output +
    read * p.cache_read +
    write * p.cache_write
  ) / 1_000_000;
}

function deriveArea(operation: string): string {
  if (operation.includes("import")) return "site_import";
  return "site_build";
}

export interface LogAiCallOptions {
  siteId?: string | null;
  operation: string;
  model: string;
  maxTokens?: number;
  systemPrompt?: string;
  messages: MessageParam[];
  response: Message;
  durationMs: number;
}

/** Fire-and-forget — never throws. Returns the inserted cost_event id (or null on failure). */
export async function logAiCall(opts: LogAiCallOptions): Promise<string | null> {
  try {
    const usage = opts.response.usage;
    const { read: cacheRead, write: cacheWrite } = cacheTokens(usage);

    const messagesJson = JSON.stringify(opts.messages);
    const messagesTruncated = messagesJson.length > MAX_MESSAGES_BYTES;

    const row = await db
      .insertInto("cost_events")
      .values({
        site_id: opts.siteId ?? null,
        type: "ai",
        vendor: "anthropic",
        area: deriveArea(opts.operation),
        operation: opts.operation,
        model: opts.model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: cacheRead,
        cache_write_tokens: cacheWrite,
        cost_usd: calcCost(opts.model, usage),
        duration_ms: opts.durationMs,
        metadata: JSON.stringify({
          max_tokens: opts.maxTokens ?? null,
          messages_truncated: messagesTruncated,
          response_chars: opts.response.content
            .filter(c => c.type === "text")
            .reduce((n, c) => n + (c as { text: string }).text.length, 0),
        }),
      })
      .returning("id")
      .executeTakeFirst();

    return row?.id ?? null;
  } catch (err) {
    console.warn({ err }, "cost_event (ai) log failed — non-fatal");
    return null;
  }
}

export interface LogCostEventOptions {
  siteId?: string | null;
  type: "api" | "storage" | "dns" | "cdn";
  vendor: string;
  area: string;
  operation: string;
  costUsd: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/** Fire-and-forget — never throws. Returns the inserted cost_event id (or null on failure). */
export async function logCostEvent(opts: LogCostEventOptions): Promise<string | null> {
  try {
    const row = await db
      .insertInto("cost_events")
      .values({
        site_id: opts.siteId ?? null,
        type: opts.type,
        vendor: opts.vendor,
        area: opts.area,
        operation: opts.operation,
        cost_usd: opts.costUsd,
        duration_ms: opts.durationMs ?? null,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      })
      .returning("id")
      .executeTakeFirst();

    return row?.id ?? null;
  } catch (err) {
    console.warn({ err }, "cost_event log failed — non-fatal");
    return null;
  }
}
