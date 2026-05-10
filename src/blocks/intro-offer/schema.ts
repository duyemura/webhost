import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("intro-offer"),
  headline: z.string().max(150),
  price: z.string().max(50),
  period: z.string().max(50).optional(),
  details: z.string().max(400).optional(),
  cta: z.object({ text: z.string(), url: z.string() }),
});

export const introOfferBlock: BlockDefinition = {
  type: "intro-offer",
  schema,
  render,
  aiSchema: {
    type: "intro-offer",
    fields: {
      headline: "string (required)",
      price: "string e.g. '$99' (required)",
      period: "string e.g. 'for 30 days' (optional)",
      details: "string (optional, max 400 chars)",
      cta: "{ text, url } (required)",
    },
  },
};
