import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("features"),
  headline: z.string().max(150).optional(),
  subheadline: z.string().max(400).optional(),
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
      headline: "string (optional)",
      subheadline: "string (optional)",
      items: "Array<{ icon?: string, title: string, description: string }> (1–12 items)",
    },
  },
};
