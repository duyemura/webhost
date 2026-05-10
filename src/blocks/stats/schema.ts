import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("stats"),
  headline: z.string().max(150).optional(),
  items: z.array(z.object({
    value: z.string().max(50),
    label: z.string().max(100),
  })).min(1).max(6),
});

export const statsBlock: BlockDefinition = {
  type: "stats",
  schema,
  render,
  aiSchema: {
    type: "stats",
    fields: {
      headline: "string (optional)",
      items: "Array<{ value: string, label: string }> (1–6)",
    },
  },
};
