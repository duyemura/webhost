import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("marquee"),
  items: z.array(z.string().min(1).max(80)).min(2).max(20),
  speed: z.number().min(10).max(120).optional(),
});

export const marqueeBlock: BlockDefinition = {
  type: "marquee",
  schema,
  render,
  aiSchema: {
    type: "marquee",
    fields: {
      items: "string[] (2–20 short labels, e.g. program or service names)",
    },
  },
};
