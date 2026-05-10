import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("reviews"),
  headline: z.string().max(150).optional(),
  items: z.array(z.object({
    text: z.string().max(600),
    author: z.string().max(100),
    rating: z.number().int().min(1).max(5).optional(),
    platform: z.string().max(50).optional(),
    date: z.string().max(30).optional(),
  })).min(1).max(9),
});

export const reviewsBlock: BlockDefinition = {
  type: "reviews",
  schema,
  render,
  aiSchema: {
    type: "reviews",
    fields: {
      headline: "string (optional)",
      items: "Array<{ text, author, rating?: 1-5, platform?, date? }> (1–9)",
    },
  },
};
