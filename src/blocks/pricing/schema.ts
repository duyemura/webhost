import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("pricing"),
  headline: z.string().max(150).optional(),
  subheadline: z.string().max(400).optional(),
  items: z.array(z.object({
    name: z.string().max(100),
    description: z.string().max(300).optional(),
    price: z.string().max(50),
    period: z.string().max(50).optional(),
    features: z.array(z.string().max(150)),
    cta: z.object({ text: z.string(), url: z.string() }),
    featured: z.boolean().optional(),
    badge: z.string().max(50).optional(),
  })).min(1).max(4),
});

export const pricingBlock: BlockDefinition = {
  type: "pricing",
  schema,
  render,
  aiSchema: {
    type: "pricing",
    fields: {
      headline: "string (optional)",
      subheadline: "string (optional)",
      items: "Array<{ name, description?, price, period?, features: string[], cta: { text, url }, featured?, badge? }> (1–4)",
    },
  },
};
