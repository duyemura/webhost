import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("contact-form"),
  headline: z.string().max(200).optional(),
  subheadline: z.string().max(400).optional(),
  include_phone: z.boolean().optional(),
  submit_label: z.string().max(60).optional(),
  recipient_email: z.string().optional(),
});

export const contactFormBlock: BlockDefinition = {
  type: "contact-form",
  schema,
  render,
  aiSchema: {
    type: "contact-form",
    fields: {
      headline: "string (optional, e.g. 'Get in touch' or 'Contact us')",
      subheadline: "string (optional, supporting copy)",
      include_phone: "boolean (optional, true to add a phone field)",
      submit_label: "string (optional, button label, default 'Send message')",
      recipient_email: "string (optional, leave empty — will be filled by owner)",
    },
  },
};
