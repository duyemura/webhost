import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("rich-text"),
  headline: z.string().max(150).optional(),
  html: z.string().max(20000),
});

export const richTextBlock: BlockDefinition = {
  type: "rich-text",
  schema,
  render,
  aiSchema: {
    type: "rich-text",
    fields: {
      headline: "string (optional)",
      html: "raw HTML string (required, max 20000 chars — use only safe tags: p, h2-h4, ul, ol, li, strong, em, a, br)",
    },
  },
};
