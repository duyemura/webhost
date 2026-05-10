import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("hero"),
  eyebrow: z.string().max(120).optional(),
  headline: z.string().min(1).max(200),
  accent_words: z.array(z.string().max(50)).max(5).optional(),
  subheadline: z.string().max(400).optional(),
  cta_primary: z.object({ text: z.string(), url: z.string() }).optional(),
  cta_secondary: z.object({ text: z.string(), url: z.string() }).optional(),
  background: z.object({
    style: z.enum(["color", "image", "dark"]),
    value: z.string().optional(),
  }).optional(),
  background_video_url: z.string().optional(),
  image_url: z.string().optional(),
  stats_bar: z.array(z.object({
    value: z.string().max(20),
    label: z.string().max(60),
  })).max(6).optional(),
});

export const heroBlock: BlockDefinition = {
  type: "hero",
  schema,
  render,
  aiSchema: {
    type: "hero",
    fields: {
      eyebrow: "string (optional, short label shown above headline)",
      headline: "string (required, use \\n for line breaks)",
      accent_words: "string[] (optional, words in headline to highlight in primary color)",
      subheadline: "string (optional, max 400 chars)",
      cta_primary: "{ text, url } (optional)",
      cta_secondary: "{ text, url } (optional)",
      background: "{ style: 'color'|'image'|'dark', value?: string } (optional)",
      background_video_url: "string (optional, MP4 URL for fullscreen background video with overlay)",
      stats_bar: "Array<{ value, label }> (optional, 2–4 key stats shown below CTAs)",
    },
  },
};
