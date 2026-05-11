import { z } from "zod";
import type { BlockDefinition } from "../types.js";
import { render } from "./renderer.js";

const schema = z.object({
  id: z.string(),
  type: z.literal("faq"),
  headline: z.string().max(150).optional(),
  items: z.array(z.object({
    question: z.string().max(300),
    answer: z.string().max(3000),
  })).min(1).max(20),
});

export const faqBlock: BlockDefinition = {
  type: "faq",
  schema,
  render,
  aiSchema: {
    type: "faq",
    fields: {
      headline: "string (optional) — e.g. 'Frequently asked questions'",
      items: `Array<{ question: string, answer: string }> — EXACTLY 10 items required.

FAQ QUALITY RULES (AEO + SEO):
- Questions must be what real people ask AI assistants or Google about this specific page's topic. Think: "What is X?", "How does X work?", "How much does X cost?", "What results can I expect from X?", "Is X right for me?", "How do I get started with X?", "What makes [business] different?", "Where is [business] located?", "What are [business] hours?", "Do you offer X?".
- Every question must be tightly tied to the page content — not generic gym FAQs copy-pasted from a template.
- Answers must be comprehensive and substantive (150–400 words each). They are hidden behind a toggle so length is fine. Thin answers kill AEO; AI assistants need dense, factual, specific context to cite this page.
- Answers should include: specific facts from the scraped content, named services/programs/features, real business details (address, phone, hours if known), concrete outcomes or differentiators, and when relevant a clear call to action at the end.
- Do NOT write answers like "Contact us to learn more." — that is useless for SEO/AEO. Write the actual answer, then optionally add a CTA.
- Cover a variety of intents: informational, navigational, transactional, and comparison (e.g. "How is X different from a regular gym?").`,
    },
  },
};
