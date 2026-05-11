import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("programs"),
  eyebrow: z.string().max(120).optional(),
  headline: z.string().max(200).optional(),
  subheadline: z.string().max(600).optional(),
  items: z.array(z.object({
    name: z.string().max(100),
    description: z.string().max(600),
    image_url: z.string().optional(),
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
      eyebrow: "string (optional)",
      headline: "string (optional, use \\n for line breaks)",
      subheadline: "string (optional, body text shown right of headline in dark-industrial)",
      items: "Array<{ name, description, image_url?: string, tag?, cta?: { text, url } }> (1–9 items). For image_url: use a downloaded asset URL from the Downloaded images list. Match by alt text or section hint to the relevant program. If multiple images exist, distribute one per item. If only one image exists, assign it to the most prominent item. Leave image_url omitted only if no downloaded images are available at all.",
    },
  },
};
