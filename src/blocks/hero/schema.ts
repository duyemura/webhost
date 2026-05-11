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
      cta_secondary: "{ text, url } (optional — only include if the source site explicitly has two CTAs)",
      background: "{ style: 'color'|'image'|'dark', value?: string } — IF a downloaded image is available for the hero/banner area, set { style: 'image', value: '<exact asset URL from Downloaded images list>' }. This creates a full-bleed photo background. Do NOT use style:'image' without a real URL.",
      background_video_url: "string (optional, MP4 URL for fullscreen background video with overlay)",
      image_url: "string — DEPRECATED. Use background: { style: 'image', value: '<url>' } instead. Only set this if no background is set.",
      stats_bar: "Array<{ value, label }> (optional, 2–4 key stats shown below CTAs)",
    },
  },
  copyGuidelines: `Headline:
- Maximum 6 words. Shorter is always better.
- Must fit 1–2 lines at desktop (1200px) and no more than 3 lines at mobile (375px).
- Do not copy the brand's tagline verbatim — distill it shorter if needed.
- Avoid stacked all-caps fragments ("AWESOME FOR EVERYONE. SHAME FREE." breaks badly on mobile).
- Prefer a single punchy phrase over multiple sentence fragments.
- Good: "Get seriously strong." / "Train like you mean it."
- Bad: "AWESOME FOR EVERYONE. SHAME FREE. MIGHTY STRONG."

Subheadline:
- One sentence, maximum 15 words.
- Must not wrap at 600px viewport width.

CTAs:
- Default to ONE cta_primary only. Omit cta_secondary unless the source site explicitly shows two CTAs.
- Button text: verb + noun, 2–3 words. No ending punctuation.
- Good: "Start free trial" / "Book a class"
- Bad: "Click here to get started today!"`,
};
