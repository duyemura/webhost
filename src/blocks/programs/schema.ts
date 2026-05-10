import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("programs"),
  headline: z.string().max(150).optional(),
  subheadline: z.string().max(400).optional(),
  items: z.array(z.object({
    name: z.string().max(100),
    description: z.string().max(600),
    tag: z.string().max(50).optional(),
    cta: z.object({ text: z.string(), url: z.string() }).optional(),
  })).min(1).max(9),
});

export const programsBlock: BlockDefinition = {
  type: "programs",
  schema,
  render,
  aiSchema: {
    type: "programs",
    fields: {
      headline: "string (optional)",
      subheadline: "string (optional)",
      items: "Array<{ name, description, tag?, cta?: { text, url } }> (1–9)",
    },
  },
};
