import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("hero"),
  headline: z.string().min(1).max(150),
  subheadline: z.string().max(400).optional(),
  cta_primary: z.object({ text: z.string(), url: z.string() }).optional(),
  cta_secondary: z.object({ text: z.string(), url: z.string() }).optional(),
  background: z.object({
    style: z.enum(["color", "image", "dark"]),
    value: z.string().optional(),
  }).optional(),
  image_url: z.string().optional(),
});

export const heroBlock: BlockDefinition = {
  type: "hero",
  schema,
  render,
  aiSchema: {
    type: "hero",
    fields: {
      headline: "string (required, max 150 chars)",
      subheadline: "string (optional, max 400 chars)",
      cta_primary: "{ text, url } (optional)",
      cta_secondary: "{ text, url } (optional)",
      background: "{ style: 'color'|'image'|'dark', value?: string } (optional)",
    },
  },
};
