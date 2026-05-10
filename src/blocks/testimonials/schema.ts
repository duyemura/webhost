import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("testimonials"),
  eyebrow: z.string().max(120).optional(),
  headline: z.string().max(200).optional(),
  items: z.array(z.object({
    quote: z.string().max(600),
    name: z.string().max(100),
    role: z.string().max(100).optional(),
    avatar_url: z.string().optional(),
  })).min(1).max(9),
});

export const testimonialsBlock: BlockDefinition = {
  type: "testimonials",
  schema,
  render,
  aiSchema: {
    type: "testimonials",
    fields: {
      eyebrow: "string (optional, short label above headline)",
      headline: "string (optional, use \\n for line breaks)",
      items: "Array<{ quote, name, role?, avatar_url? }> (1–9)",
    },
  },
};
