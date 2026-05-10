import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("about"),
  headline: z.string().max(150).optional(),
  body: z.string().max(2000),
  image_url: z.string().optional(),
  cta: z.object({ text: z.string(), url: z.string() }).optional(),
  image_position: z.enum(["left", "right"]).optional(),
});

export const aboutBlock: BlockDefinition = {
  type: "about",
  schema,
  render,
  aiSchema: {
    type: "about",
    fields: {
      headline: "string (optional)",
      body: "string (required, up to 2000 chars)",
      image_url: "string (optional)",
      cta: "{ text, url } (optional)",
      image_position: "'left' | 'right' (optional, default 'right')",
    },
  },
};
