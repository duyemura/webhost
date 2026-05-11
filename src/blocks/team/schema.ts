import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("team"),
  headline: z.string().max(150).optional(),
  members: z.array(z.object({
    name: z.string().max(100),
    role: z.string().max(100).optional(),
    bio: z.string().max(500).optional(),
    photo_url: z.string().optional(),
  })).min(1).max(12),
});

export const teamBlock: BlockDefinition = {
  type: "team",
  schema,
  render,
  aiSchema: {
    type: "team",
    fields: {
      headline: "string (optional)",
      members: "Array<{ name, role?, bio?, photo_url? }> (1–12). For photo_url: use a downloaded asset URL if the alt text contains the person's name or words like 'coach', 'trainer', 'staff'. Leave empty if no matching image was downloaded.",
    },
  },
};
