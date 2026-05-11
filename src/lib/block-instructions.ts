import { db } from "../db/client.js";

export interface AiSchemaShape {
  type: string;
  fields: Record<string, string>;
}

interface InstructionRow {
  fieldName: string | null;
  instruction: string;
}

export interface FetchedInstructions {
  global: string[];
  byBlock: Map<string, InstructionRow[]>;
}

/** Fetch active instructions from DB. Falls back to empty on any error (additive-only feature). */
export async function fetchInstructions(): Promise<FetchedInstructions> {
  try {
    const rows = await db
      .selectFrom("block_instructions")
      .select(["block_type", "field_name", "instruction"])
      .where("active", "=", true)
      .orderBy("created_at", "asc")
      .execute();

    const global: string[] = [];
    const byBlock = new Map<string, InstructionRow[]>();

    for (const row of rows) {
      if (!row.block_type) {
        global.push(row.instruction);
      } else {
        if (!byBlock.has(row.block_type)) byBlock.set(row.block_type, []);
        byBlock.get(row.block_type)!.push({ fieldName: row.field_name, instruction: row.instruction });
      }
    }

    return { global, byBlock };
  } catch (err) {
    console.error({ err }, "block-instructions: fetchInstructions failed — continuing without custom instructions");
    return { global: [], byBlock: new Map() };
  }
}

/**
 * Merge DB instructions into an aiSchema's field descriptions.
 * Field-scoped instructions (fieldName set) append to the matching field description.
 * Block-level instructions (fieldName null) are appended as a _notes pseudo-field.
 */
export function mergeInstructions(
  aiSchema: AiSchemaShape,
  byBlock: Map<string, InstructionRow[]>,
): AiSchemaShape {
  const extra = byBlock.get(aiSchema.type);
  if (!extra?.length) return aiSchema;

  const merged = { ...aiSchema, fields: { ...aiSchema.fields } };
  const blockNotes: string[] = [];

  for (const { fieldName, instruction } of extra) {
    if (!fieldName) {
      blockNotes.push(instruction);
    } else if (fieldName in merged.fields) {
      merged.fields[fieldName] = `${merged.fields[fieldName]} — ${instruction}`;
    } else {
      merged.fields[fieldName] = instruction;
    }
  }

  if (blockNotes.length) {
    merged.fields["_block_notes"] = blockNotes.join(" | ");
  }

  return merged;
}
