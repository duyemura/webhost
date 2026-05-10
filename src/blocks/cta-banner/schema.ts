import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("cta-banner"),
  headline: z.string().max(150),
  subheadline: z.string().max(400).optional(),
  cta_primary: z.object({ text: z.string(), url: z.string() }),
  cta_secondary: z.object({ text: z.string(), url: z.string() }).optional(),
});

export const ctaBannerBlock: BlockDefinition = {
  type: "cta-banner",
  schema,
  render,
  aiSchema: {
    type: "cta-banner",
    fields: {
      headline: "string (required)",
      subheadline: "string (optional)",
      cta_primary: "{ text, url } (required)",
      cta_secondary: "{ text, url } (optional)",
    },
  },
};
