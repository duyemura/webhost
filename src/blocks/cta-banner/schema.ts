import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("cta-banner"),
  eyebrow: z.string().max(120).optional(),
  headline: z.string().max(200),
  subheadline: z.string().max(400).optional(),
  cta_primary: z.object({ text: z.string(), url: z.string() }),
  cta_secondary: z.object({ text: z.string(), url: z.string() }).optional(),
  layout: z.enum(["horizontal", "centered"]).optional(),
});

export const ctaBannerBlock: BlockDefinition = {
  type: "cta-banner",
  schema,
  render,
  aiSchema: {
    type: "cta-banner",
    fields: {
      eyebrow: "string (optional, short label above headline)",
      headline: "string (required, use \\n for line breaks)",
      subheadline: "string (optional)",
      cta_primary: "{ text, url } (required)",
      cta_secondary: "{ text, url } (optional)",
      layout: "'horizontal' | 'centered' (optional, 'centered' for dark-industrial full-width strip)",
    },
  },
};
