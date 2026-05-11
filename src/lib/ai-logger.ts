import { db } from "../db/client.js";
import type { Message, MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

const MODEL_PRICING: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  "claude-opus-4-7":            { input: 15.00,  output: 75.00,  cache_read: 1.50,  cache_write: 3.75 },
  "claude-sonnet-4-6":          { input: 3.00,   output: 15.00,  cache_read: 0.30,  cache_write: 3.75 },
  "claude-haiku-4-5-20251001":  { input: 0.80,   output: 4.00,   cache_read: 0.08,  cache_write: 1.00 },
};

const MAX_MESSAGES_BYTES = 100_000;

function cacheTokens(usage: Message["usage"]) {
  const u = usage as unknown as Record<string, unknown>;
  return {
    read: (u["cache_read_input_tokens"] as number | null) ?? 0,
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

function extractResponseText(msg: Message): string {
  return msg.content
    .filter(c => c.type === "text")
    .map(c => (c as { type: "text"; text: string }).text)
    .join("\n")
    .slice(0, 10_000);
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

/** Fire-and-forget — never throws. Returns the inserted row id (or null on failure). */
export async function logAiCall(opts: LogAiCallOptions): Promise<string | null> {
  try {
    const usage = opts.response.usage;
    const { read: cacheRead, write: cacheWrite } = cacheTokens(usage);

    const messagesJson = JSON.stringify(opts.messages);
    const messagesStored = messagesJson.length > MAX_MESSAGES_BYTES
      ? JSON.stringify([{ role: "truncated", content: `[${messagesJson.length} bytes — truncated]` }])
      : messagesJson;

    const row = await db
      .insertInto("ai_calls")
      .values({
        site_id: opts.siteId ?? null,
        operation: opts.operation,
        model: opts.model,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cache_read_tokens: cacheRead,
        cache_write_tokens: cacheWrite,
        cost_usd: calcCost(opts.model, usage),
        max_tokens: opts.maxTokens ?? null,
        system_prompt: opts.systemPrompt?.slice(0, 10_000) ?? null,
        messages: messagesStored,
        response_text: extractResponseText(opts.response),
        duration_ms: opts.durationMs,
      })
      .returning("id")
      .executeTakeFirst();

    return row?.id ?? null;
  } catch (err) {
    console.warn({ err }, "ai_call log failed — non-fatal");
    return null;
  }
}
