import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("faq"),
  headline: z.string().max(150).optional(),
  items: z.array(z.object({
    question: z.string().max(300),
    answer: z.string().max(1500),
  })).min(1).max(20),
});

export const faqBlock: BlockDefinition = {
  type: "faq",
  schema,
  render,
  aiSchema: {
    type: "faq",
    fields: {
      headline: "string (optional)",
      items: "Array<{ question, answer }> (1–20)",
    },
  },
};
