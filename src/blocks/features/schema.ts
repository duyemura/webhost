import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("features"),
  eyebrow: z.string().max(120).optional(),
  headline: z.string().max(200).optional(),
  subheadline: z.string().max(600).optional(),
  items: z.array(z.object({
    icon: z.string().optional(),
    title: z.string().max(100),
    description: z.string().max(500),
  })).min(1).max(12),
});

export const featuresBlock: BlockDefinition = {
  type: "features",
  schema,
  render,
  aiSchema: {
    type: "features",
    fields: {
      eyebrow: "string (optional, short label above headline)",
      headline: "string (optional, use \\n for line breaks)",
      subheadline: "string (optional, body text — appears right of headline in dark-industrial)",
      items: "Array<{ icon?: string, title: string, description: string }> (1–12 items)",
    },
  },
};
