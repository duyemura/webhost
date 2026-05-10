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
      images: "Array<{ url, alt? }> (1–18)",
    },
  },
};
