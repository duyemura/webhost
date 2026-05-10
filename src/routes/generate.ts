import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { specSchema } from "./schemas.js";
import { anthropic } from "../lib/anthropic.js";
import { registry } from "../blocks/index.js";
import { THEME_PRESETS } from "../render/theme-presets.js";
import { DEFAULT_THEME } from "../blocks/types.js";
import type { BusinessProfile } from "../db/types.js";

const bodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  theme_preset: z.string().optional(),
});

const SYSTEM_PROMPT = `You are an expert web designer specializing in small business websites, especially fitness and gym businesses.

Your job is to call the create_website_spec tool with a complete website specification JSON for the business described by the user.

Guidelines:
- Generate 1–3 pages. The first page MUST have slug "index".
- Each page should have 3–8 sections using the available block types.
- The index page MUST start with a "hero" block.
- Use {{business.name}}, {{business.city}}, {{business.state}}, {{business.phone}}, {{business.email}}, {{business.hours}}, {{business.address}}, {{business.description}} tokens in text content where appropriate so content updates automatically when the business profile changes.
- Write compelling, specific copy — not generic placeholders. Adapt the tone and content to what the user asked for.
- For FAQ blocks, write real questions a prospective member would ask.
- For stats blocks, use realistic numbers (ask the user or make reasonable assumptions based on context).
- For testimonials/reviews, write realistic-sounding quotes from members.
- Include a contact page with a map-location block if the business has a physical location.
- Each section needs a unique string "id" field (use short descriptive IDs like "h1", "about1", "pricing1").
- All section objects must include both "id" and "type" fields.`;

function buildUserMessage(prompt: string, profile: BusinessProfile | null): string {
  const lines: string[] = [];

  if (profile) {
    lines.push("Business context:");
    if (profile.biz_name) lines.push(`  Name: ${profile.biz_name}`);
    if (profile.city && profile.state) lines.push(`  Location: ${profile.city}, ${profile.state}`);
    else if (profile.city) lines.push(`  City: ${profile.city}`);
    if (profile.description) lines.push(`  Description: ${profile.description}`);
    if (profile.phone) lines.push(`  Phone: ${profile.phone}`);
    if (profile.email) lines.push(`  Email: ${profile.email}`);
    if (profile.hours) lines.push(`  Hours: ${profile.hours}`);
    if (profile.address) lines.push(`  Address: ${profile.address}`);
    lines.push("");
  }

  lines.push(`Request: ${prompt}`);
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
      version: { type: "number", enum: [1], description: "Always 1" },
      pages: {
        type: "array",
        description: "Array of pages. First page must have slug 'index'.",
        items: {
          type: "object",
          required: ["slug", "title", "meta_description", "sections"],
          properties: {
            slug: { type: "string", description: "URL slug: 'index', 'contact', 'programs', etc." },
            title: { type: "string", description: "Page <title> tag" },
            meta_description: { type: "string", description: "Meta description for SEO, max 160 chars" },
            sections: {
              type: "array",
              description: `Array of section objects. Each must have 'id' (unique string) and 'type' (one of: ${sectionTypes.join(", ")}).\n\nAvailable block types and their fields:\n${sectionDescriptions}`,
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
        maxItems: 4,
      },
    },
    required: ["version", "pages"],
  };
}


export const generateRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.post("/api/sites/:id/generate", async (req, reply) => {
    const { id } = req.params as { id: string };

    const body = bodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.badRequest(`Invalid request: ${body.error.issues.map(i => i.message).join("; ")}`);
    }

    const site = await db
      .selectFrom("sites")
      .select(["id", "published_at", "slug", "custom_domain"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const profile = await db
      .selectFrom("business_profiles")
      .selectAll()
      .where("site_id", "=", id)
      .executeTakeFirst();

    const userMessage = buildUserMessage(body.data.prompt, profile ?? null);
    const inputSchema = buildInputSchema();

    let specData: unknown;
    try {
      const msg = await anthropic.messages.create({
        model: "claude-opus-4-7",
        max_tokens: 8000,
        tools: [{
          name: "create_website_spec",
          description: "Generates the complete website specification as structured JSON. Call this tool with the full spec.",
          input_schema: inputSchema as { type: "object"; properties: Record<string, unknown> },
        }],
        tool_choice: { type: "tool", name: "create_website_spec" },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      const toolUse = msg.content.find(c => c.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        return reply.internalServerError("AI did not return a tool_use block.");
      }
      specData = toolUse.input;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return reply.internalServerError(`AI generation failed: ${msg}`);
    }

    const parsed = specSchema.safeParse(specData);
    if (!parsed.success) {
      return reply.internalServerError(`AI returned invalid spec: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
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
        generation_prompt: body.data.prompt,
        updated_at: now,
        draft_updated_at: now,
        // First generation makes the site previewable at {slug}.localhost:3000 without a separate publish step.
        ...(site.published_at ? {} : { published_at: now }),
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });
};
