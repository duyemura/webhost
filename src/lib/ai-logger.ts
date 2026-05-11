import { db } from "../db/client.js";
import type { Message, MessageParam } from "@anthropic-ai/sdk/resources/messages.js";

// Pricing per million tokens (as of 2025)
const MODEL_PRICING: Record<string, { input: number; output: number; cache_read: number; cache_write: number }> = {
  "claude-opus-4-7":            { input: 15.00,  output: 75.00,  cache_read: 1.50,  cache_write: 3.75 },
  "claude-sonnet-4-6":          { input: 3.00,   output: 15.00,  cache_read: 0.30,  cache_write: 3.75 },
  "claude-haiku-4-5-20251001":  { input: 0.80,   output: 4.00,   cache_read: 0.08,  cache_write: 1.00 },
};

function calcCost(model: string, usage: Message["usage"]): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING["claude-sonnet-4-6"]!;
  const cacheRead = ("cache_read_input_tokens" in usage ? (usage.cache_read_input_tokens as number) : 0) ?? 0;
  const cacheWrite = ("cache_creation_input_tokens" in usage ? (usage.cache_creation_input_tokens as number) : 0) ?? 0;
  return (
    (usage.input_tokens * p.input +
     usage.output_tokens * p.output +
     cacheRead * p.cache_read +
     cacheWrite * p.cache_write) / 1_000_000
  );
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

/** Fire-and-forget — never throws. */
export async function logAiCall(opts: LogAiCallOptions): Promise<string | null> {
  try {
    const usage = opts.response.usage;
    const cacheRead = ("cache_read_input_tokens" in usage ? (usage.cache_read_input_tokens as number) : 0) ?? 0;
    const cacheWrite = ("cache_creation_input_tokens" in usage ? (usage.cache_creation_input_tokens as number) : 0) ?? 0;

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
        messages: JSON.stringify(opts.messages),
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
