import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("video"),
  headline: z.string().max(150).optional(),
  subheadline: z.string().max(400).optional(),
  url: z.string(),
});

export const videoBlock: BlockDefinition = {
  type: "video",
  schema,
  render,
  aiSchema: {
    type: "video",
    fields: {
      headline: "string (optional)",
      subheadline: "string (optional)",
      url: "YouTube or Vimeo URL (required)",
    },
  },
};
