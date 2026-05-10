import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("map-location"),
  headline: z.string().max(150).optional(),
  show_map: z.boolean().optional(),
  show_hours: z.boolean().optional(),
  show_phone: z.boolean().optional(),
  show_email: z.boolean().optional(),
});

export const mapLocationBlock: BlockDefinition = {
  type: "map-location",
  schema,
  render,
  aiSchema: {
    type: "map-location",
    fields: {
      headline: "string (optional)",
      show_map: "boolean (optional, default true)",
      show_hours: "boolean (optional, default true)",
      show_phone: "boolean (optional, default true)",
      show_email: "boolean (optional)",
    },
  },
};
