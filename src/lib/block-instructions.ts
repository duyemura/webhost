import { db } from "../db/client.js";

export interface MergedAiSchema {
  type: string;
  fields: Record<string, string>;
}

/** Fetch active instructions from DB, return keyed by block_type (null = global). */
export async function fetchInstructions(): Promise<{ global: string[]; byBlock: Map<string, string[]> }> {
  const rows = await db
    .selectFrom("block_instructions")
    .select(["block_type", "field_name", "instruction"])
    .where("active", "=", true)
    .orderBy("created_at", "asc")
    .execute();

  const global: string[] = [];
  const byBlock = new Map<string, string[]>();

  for (const row of rows) {
    const text = row.field_name
      ? `${row.field_name}: ${row.instruction}`
      : row.instruction;

    if (!row.block_type) {
      global.push(text);
    } else {
      if (!byBlock.has(row.block_type)) byBlock.set(row.block_type, []);
      byBlock.get(row.block_type)!.push(text);
    }
  }

  return { global, byBlock };
}

/**
 * Merge DB instructions into the aiSchema field descriptions for a block type.
 * DB instructions override or append to the default field descriptions.
 */
export function mergeInstructions(
  aiSchema: MergedAiSchema,
  byBlock: Map<string, string[]>,
): MergedAiSchema {
  const extra = byBlock.get(aiSchema.type);
  if (!extra?.length) return aiSchema;

  const merged = { ...aiSchema, fields: { ...aiSchema.fields } };
  for (const entry of extra) {
    const colonIdx = entry.indexOf(": ");
    if (colonIdx > 0) {
      const field = entry.slice(0, colonIdx);
      const override = entry.slice(colonIdx + 2);
      if (field in merged.fields) {
        merged.fields[field] = `${merged.fields[field]} — ${override}`;
      } else {
        merged.fields[field] = override;
      }
    }
  }
  return merged;
}
