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
- Target 4–8 words. Hard max: 10 words. Specificity beats brevity — a specific 7-word headline beats a vague 4-word one.
- Lead with the outcome the customer WANTS, not what the business does.
- NEVER copy the source site's tagline verbatim — rewrite it.
- ONE idea only. No stacked fragments. "More than just a gym. A community that changes." = bad (two sentences, layout-breaking).
- Good: "Earn it." / "Get seriously strong." / "Your first class is free." / "Stronger in 30 days or your money back."
- Bad: "More Than Just a Gym." (cliché/vague) / "We Help You Achieve Your Goals" (generic) / stacked fragment sentences.

Subheadline:
- One sentence only, maximum 12 words.
- Addresses the core promise or eliminates a key fear.
- Good: "No experience needed — just show up." / "Real results for real people."

CTAs:
- One cta_primary only. Omit cta_secondary unless the source site explicitly shows two CTAs.
- Button text: verb + noun, 2–3 words. No punctuation.
- Good: "Start free trial" / "Book a class" / "Claim your spot"
- Bad: "Click here to get started today!"`,
};
