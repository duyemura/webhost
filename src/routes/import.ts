import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { specSchema } from "./schemas.js";
import { anthropic } from "../lib/anthropic.js";
import { registry } from "../blocks/index.js";
import { THEME_PRESETS } from "../render/theme-presets.js";
import { DEFAULT_THEME } from "../blocks/types.js";
import { scrapeWebsite } from "../lib/scrape.js";
import type { ScrapeResult } from "../lib/scrape.js";

const bodySchema = z.object({
  url: z.string().url("Must be a valid URL"),
  theme_preset: z.string().optional(),
});

const IMPORT_SYSTEM_PROMPT = `You are an expert web designer converting an existing website into a structured block-based spec.

Your job is to call the create_website_spec tool with a complete spec that mirrors the structure and content of the scraped website.

Guidelines:
- Create one page per scraped page. The homepage MUST use slug "index".
- Map each scraped section to the best matching block type.
- Prefer specific block types over rich-text. Only use rich-text when nothing else fits.
- Extract real content from the scraped text — headlines, copy, list items, button labels.
- Replace any business name/phone/email/address with {{business.name}}, {{business.phone}}, {{business.email}}, {{business.address}}, {{business.hours}}, {{business.city}}, {{business.state}} tokens where appropriate.
- Keep the ordering and structure of the original site as closely as possible.
- Each section needs a unique string "id" field (short descriptive IDs like "hero1", "about1").
- For sections you cannot confidently map to any block type, use rich-text and include a note in the _gaps array.
- The _gaps array should contain plain English descriptions of content patterns you saw but couldn't represent well (e.g. "Interactive class schedule calendar", "Custom booking widget"). These help developers know which block types to build next.`;

function buildImportUserMessage(scrape: ScrapeResult): string {
  const lines: string[] = [
    `Website: ${scrape.site_name} (${scrape.base_url})`,
    `Pages found: ${scrape.pages.length}`,
    "",
    "Scraped content:",
    "",
  ];

  for (const page of scrape.pages) {
    lines.push(`=== PAGE: ${page.title || page.slug} (slug: ${page.slug}) ===`);
    lines.push(`URL: ${page.url}`);
    lines.push(`Sections found: ${page.sections.length}`);
    lines.push("");

    for (const section of page.sections) {
      lines.push(`--- Section [${section.tag}] class="${section.class_hints}" ---`);
      if (section.heading) lines.push(`Heading: ${section.heading}`);
      if (section.subheading && section.subheading !== section.heading) lines.push(`Subheading: ${section.subheading}`);
      if (section.paragraphs.length > 0) lines.push(`Text: ${section.paragraphs.join(" | ")}`);
      if (section.buttons.length > 0) lines.push(`Buttons/CTAs: ${section.buttons.join(", ")}`);
      if (section.list_items.length > 0) lines.push(`List items: ${section.list_items.slice(0, 8).join(" | ")}`);
      if (section.image_alts.length > 0) lines.push(`Images: ${section.image_alts.join(", ")}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function buildInputSchema(): object {
  const sectionTypes = registry.getTypes();
  const aiSchemas = registry.toAISchema() as Record<string, { type: string; fields: Record<string, string> }>;

  const sectionDescriptions = sectionTypes
    .map(type => {
      const schema = aiSchemas[type];
      const fields = schema?.fields
        ? Object.entries(schema.fields).map(([k, v]) => `    ${k}: ${v}`).join("\n")
        : "";
      return `  ${type}:\n${fields}`;
    })
    .join("\n\n");

  return {
    type: "object",
    properties: {
      version: { type: "number", enum: [1] },
      pages: {
        type: "array",
        description: "Array of pages mirroring the scraped site structure.",
        items: {
          type: "object",
          required: ["slug", "title", "meta_description", "sections"],
          properties: {
            slug: { type: "string" },
            title: { type: "string" },
            meta_description: { type: "string", description: "Max 160 chars" },
            sections: {
              type: "array",
              description: `Available block types:\n${sectionDescriptions}`,
              items: {
                type: "object",
                required: ["id", "type"],
                properties: {
                  id: { type: "string" },
                  type: { type: "string", enum: sectionTypes },
                },
                additionalProperties: true,
              },
            },
          },
        },
        minItems: 1,
        maxItems: 6,
      },
      _gaps: {
        type: "array",
        description: "Describe any content patterns from the scraped site that don't map well to available block types. These help developers prioritize new blocks to build.",
        items: { type: "string" },
      },
    },
    required: ["version", "pages"],
  };
}

export const importRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.post("/api/sites/:id/import-url", async (req, reply) => {
    const { id } = req.params as { id: string };

    const body = bodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.badRequest(body.error.issues.map(i => i.message).join("; "));
    }

    const site = await db
      .selectFrom("sites")
      .select(["id", "published_at", "slug"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    // 1. Scrape
    let scrape: ScrapeResult;
    try {
      scrape = await scrapeWebsite(body.data.url);
    } catch (err) {
      return reply.badRequest((err as Error).message);
    }

    // 2. Ask Claude to map to our block spec
    const userMessage = buildImportUserMessage(scrape);
    const inputSchema = buildInputSchema();

    let specData: unknown;
    let gaps: string[] = [];
    try {
      const msg = await anthropic.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 10000,
        tools: [{
          name: "create_website_spec",
          description: "Maps the scraped website content into a block-based spec. Call this with the complete spec.",
          input_schema: inputSchema as { type: "object"; properties: Record<string, unknown> },
        }],
        tool_choice: { type: "tool", name: "create_website_spec" },
        system: IMPORT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const toolUse = msg.content.find(c => c.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        return reply.internalServerError("AI did not return a structured spec.");
      }

      const input = toolUse.input as Record<string, unknown>;
      gaps = Array.isArray(input._gaps) ? (input._gaps as string[]) : [];

      // Strip _gaps before spec validation
      const { _gaps: _removed, ...specOnly } = input;
      specData = specOnly;
    } catch (err) {
      return reply.internalServerError(`AI import failed: ${(err as Error).message}`);
    }

    const parsed = specSchema.safeParse(specData);
    if (!parsed.success) {
      return reply.internalServerError(
        `AI returned invalid spec: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`
      );
    }

    const theme = (body.data.theme_preset && THEME_PRESETS[body.data.theme_preset])
      ? THEME_PRESETS[body.data.theme_preset]
      : DEFAULT_THEME;

    const now = new Date();
    const updated = await db
      .updateTable("sites")
      .set({
        spec: JSON.stringify(parsed.data),
        theme: JSON.stringify(theme),
        theme_preset: body.data.theme_preset ?? null,
        generation_prompt: `Imported from ${body.data.url}`,
        updated_at: now,
        draft_updated_at: now,
        ...(site.published_at ? {} : { published_at: now }),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return {
      ...updated,
      _import_summary: {
        source_url: body.data.url,
        pages_scraped: scrape.pages.length,
        sections_found: scrape.pages.reduce((n, p) => n + p.sections.length, 0),
        pages_generated: parsed.data.pages.length,
        blocks_generated: parsed.data.pages.reduce((n, p) => n + p.sections.length, 0),
        gaps,
      },
    };
  });
};
