import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("gallery"),
  headline: z.string().max(150).optional(),
  images: z.array(z.object({
    url: z.string(),
    alt: z.string().max(200).optional(),
  })).min(1).max(18),
});

export const galleryBlock: BlockDefinition = {
  type: "gallery",
  schema,
  render,
  aiSchema: {
    type: "gallery",
    fields: {
      headline: "string (optional)",
      images: "Array<{ url: string, alt?: string }> (1–18) — populate EVERY entry with a real URL from the Downloaded images list. Use all available downloaded images for this page. If fewer than 1 downloaded image exists, do NOT include a gallery block at all.",
    },
  },
};
