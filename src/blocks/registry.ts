import { z } from "zod";
import type { BlockDefinition, SiteSection, SiteCta, Theme } from "./types.js";
import type { BusinessProfile } from "../db/types.js";

export class BlockRegistry {
  private blocks = new Map<string, BlockDefinition>();

  register(block: BlockDefinition): void {
    this.blocks.set(block.type, block);
  }

  render(section: SiteSection, theme: Theme, profile: BusinessProfile | null, siteCta?: SiteCta): string {
    const block = this.blocks.get(section.type);
    if (!block) return "";
    try {
      return block.render(section as Record<string, unknown>, theme, profile, siteCta);
    } catch (err) {
      console.error(`Block render error [${section.type}]:`, err);
      return "";
    }
  }

  validate(raw: unknown): SiteSection {
    if (typeof raw !== "object" || raw === null || !("type" in raw)) {
      throw new Error("Section must be an object with a type field");
    }
    const r = raw as Record<string, unknown>;
    const block = this.blocks.get(r.type as string);
    if (!block) throw new Error(`Unknown block type: ${r.type as string}`);
    const base = z.object({ id: z.string(), type: z.string() });
    const parsed = base.parse(raw);
    block.schema.parse(raw);
    return { ...r, ...parsed } as SiteSection;
  }

  toAISchema(): Record<string, { type: string; fields: Record<string, string>; copyGuidelines?: string }> {
    const defs: Record<string, { type: string; fields: Record<string, string>; copyGuidelines?: string }> = {};
    for (const [type, block] of this.blocks) {
      defs[type] = block.copyGuidelines
        ? { ...block.aiSchema, copyGuidelines: block.copyGuidelines }
        : block.aiSchema;
    }
    return defs;
  }

  getTypes(): string[] {
    return [...this.blocks.keys()];
  }
}

export const registry = new BlockRegistry();
