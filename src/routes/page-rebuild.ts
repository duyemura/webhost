import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { getCachedCrawl } from "../lib/crawl-cache.js";
import { fetchInstructions, mergeInstructions } from "../lib/block-instructions.js";
import { processPage, sanitizeSlug, type DownloadedImage } from "./import.js";
import type { ScrapedPage } from "../lib/scrape.js";
import { specSchema, sectionSchema } from "./schemas.js";
import { anthropic } from "../lib/anthropic.js";
import { registry } from "../blocks/index.js";
import { logAiCall } from "../lib/ai-logger.js";

function extractImportUrl(generationPrompt: string | null): string | null {
  if (!generationPrompt) return null;
  const match = generationPrompt.match(/^Imported from (.+)$/);
  return match ? match[1].trim() : null;
}

export const pageRebuildRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.post("/api/sites/:id/pages/:slug/rebuild", async (req, reply) => {
    const { id, slug } = req.params as { id: string; slug: string };

    const site = await db
      .selectFrom("sites")
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();
    if (!site.spec) return reply.badRequest("Site has no spec to rebuild a page from.");

    const sourceUrl = extractImportUrl(site.generation_prompt);
    if (!sourceUrl) return reply.badRequest("No import URL found — this site was not created from a URL import.");

    const scrape = await getCachedCrawl(sourceUrl);
    if (!scrape) return reply.badRequest("No cached crawl found for this site. Refresh the crawl by doing a full rebuild with 'Force re-crawl' enabled.");

    // Find the scraped page matching this slug — apply same sanitization as import
    let scrapedPage: ScrapedPage | undefined;
    for (let i = 0; i < scrape.pages.length; i++) {
      const page = scrape.pages[i];
      const pageSlug = i === 0 ? "index" : sanitizeSlug(page.slug || `page-${i}`);
      if (pageSlug === slug) {
        scrapedPage = page;
        break;
      }
    }

    if (!scrapedPage) {
      return reply.notFound(`No cached page found for slug "${slug}". The crawl cache may be stale.`);
    }

    // Verify this page exists in the current spec
    const specData = site.spec as { version: number; pages: { slug: string; [key: string]: unknown }[] };
    const pageIndex = specData.pages.findIndex(p => p.slug === slug);
    if (pageIndex === -1) {
      return reply.notFound(`Page "${slug}" not found in current spec.`);
    }

    // Load business profile for GMB context
    const profile = await db
      .selectFrom("business_profiles")
      .selectAll()
      .where("site_id", "=", id)
      .executeTakeFirst();

    // Load site assets and map to DownloadedImage format for the target page
    const assets = await db
      .selectFrom("assets")
      .selectAll()
      .where("site_id", "=", id)
      .orderBy("created_at", "asc")
      .execute();

    const downloadedImages: DownloadedImage[] = assets
      .filter(a => a.mime_type.startsWith("image/"))
      .map(a => ({
        assetUrl: `/api/sites/${id}/assets/${a.filename}`,
        originalUrl: a.original_name,
        alt: a.original_name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
        pageSlug: slug,
        sectionHint: "",
      }));

    const gmb = profile ? {
      biz_name: profile.biz_name ?? undefined,
      phone: profile.phone ?? undefined,
      address: profile.address ?? undefined,
      city: profile.city ?? undefined,
      state: profile.state ?? undefined,
      hours: profile.hours ?? undefined,
      gmb_rating: profile.gmb_rating != null ? Number(profile.gmb_rating) : undefined,
      gmb_review_count: profile.gmb_review_count != null ? Number(profile.gmb_review_count) : undefined,
      gmb_reviews: profile.gmb_reviews as { author: string; rating: number; text: string }[] | undefined,
    } : undefined;

    const instructions = await fetchInstructions();

    let result;
    try {
      result = await processPage(scrapedPage, slug, scrape.site_name, downloadedImages, instructions, gmb, undefined, id);
    } catch (err) {
      return reply.internalServerError((err as Error).message);
    }

    // Patch the spec: replace the page at the same index
    const { gaps: _gaps, costEventId: _cid, ...pageData } = result;
    const newPages = [...specData.pages];
    newPages[pageIndex] = pageData;

    const newSpec = { ...specData, pages: newPages };
    const parsed = specSchema.safeParse(newSpec);
    if (!parsed.success) {
      return reply.internalServerError(`Invalid spec after rebuild: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }

    const now = new Date();
    const updated = await db
      .updateTable("sites")
      .set({
        spec: JSON.stringify(parsed.data),
        updated_at: now,
        draft_updated_at: now,
      })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });

  // ── AI page edit ──────────────────────────────────────────────────────────────

  const aiEditBodySchema = z.object({
    instruction: z.string().min(1).max(2000),
  });

  app.post("/api/sites/:id/pages/:slug/ai-edit", async (req, reply) => {
    const { id, slug } = req.params as { id: string; slug: string };

    const body = aiEditBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.badRequest(`Invalid request: ${body.error.issues.map(i => i.message).join("; ")}`);
    }

    const site = await db
      .selectFrom("sites")
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();
    if (!site.spec) return reply.badRequest("Site has no spec.");

    const specData = site.spec as { version: number; pages: { slug: string; title: string; nav_label?: string; nav_group?: string; meta_description?: string; sections: Record<string, unknown>[] }[] };
    const pageIndex = specData.pages.findIndex(p => p.slug === slug);
    if (pageIndex === -1) return reply.notFound(`Page "${slug}" not found.`);

    const page = specData.pages[pageIndex];

    const profile = await db
      .selectFrom("business_profiles")
      .selectAll()
      .where("site_id", "=", id)
      .executeTakeFirst();

    const sectionTypes = registry.getTypes();
    const rawSchemas = registry.toAISchema();
    const { global: globalInstructions, byBlock } = await fetchInstructions();

    const sectionDescriptions = sectionTypes
      .map(type => {
        const raw = rawSchemas[type];
        if (!raw) return `  ${type}:`;
        const merged = mergeInstructions(raw, byBlock);
        const fields = Object.entries(merged.fields).map(([k, v]) => `    ${k}: ${v}`).join("\n");
        return `  ${type}:\n${fields}`;
      })
      .join("\n\n");

    const globalNote = globalInstructions.length
      ? `\n\nAdditional rules:\n${globalInstructions.map(i => `- ${i}`).join("\n")}`
      : "";

    const systemPrompt = `You are an expert web content editor for small business websites.

The user will give you the current blocks for a page and an instruction to modify it.

Call the update_page tool with the complete modified page. Include ALL sections — even unchanged ones.

Rules:
- Keep existing section IDs unchanged
- Only modify what the instruction asks for
- Use {{business.name}}, {{business.phone}}, {{business.email}}, {{business.address}}, {{business.city}}, {{business.state}}, {{business.hours}} tokens for business data
- Keep the page slug unchanged
- For broad instructions (e.g. "speak to my ICP"), rewrite copy across relevant sections
- Available block types and fields:\n${sectionDescriptions}${globalNote}`;

    const profileLines: string[] = [];
    if (profile) {
      if (profile.biz_name) profileLines.push(`Business name: ${profile.biz_name}`);
      if (profile.city && profile.state) profileLines.push(`Location: ${profile.city}, ${profile.state}`);
      if (profile.description) profileLines.push(`Description: ${profile.description}`);
      if (profile.phone) profileLines.push(`Phone: ${profile.phone}`);
      if (profile.email) profileLines.push(`Email: ${profile.email}`);
      if (profile.hours) profileLines.push(`Hours: ${profile.hours}`);
    }

    const brandKit = site.brand_kit as Record<string, unknown> | null;
    if (brandKit) {
      if (brandKit.tone) profileLines.push(`Brand tone: ${String(brandKit.tone)}`);
      if (brandKit.primary_icp) profileLines.push(`Primary ICP: ${String(brandKit.primary_icp)}`);
      if (brandKit.secondary_icp) profileLines.push(`Secondary ICP: ${String(brandKit.secondary_icp)}`);
      if (brandKit.positioning) profileLines.push(`Positioning: ${String(brandKit.positioning)}`);
    }

    const userMessage = [
      profileLines.length ? `Business context:\n${profileLines.join("\n")}` : "",
      `Current page "${page.title}" (slug: ${page.slug}):`,
      `\`\`\`json\n${JSON.stringify(page.sections, null, 2)}\n\`\`\``,
      `\nInstruction: ${body.data.instruction}`,
    ].filter(Boolean).join("\n\n");

    const inputSchema = {
      type: "object",
      required: ["sections"],
      properties: {
        sections: {
          type: "array",
          description: "The complete list of sections for this page, including unchanged ones.",
          items: {
            type: "object",
            required: ["id", "type"],
            properties: {
              id: { type: "string" },
              type: { type: "string", enum: sectionTypes },
              bg: { type: "string", enum: ["default", "muted", "dark", "primary"] },
            },
            additionalProperties: true,
          },
        },
        title: { type: "string", description: "Page title (only change if instruction asks)" },
        meta_description: { type: "string", description: "SEO meta description (only change if instruction asks)" },
      },
    };

    let editedSections: unknown[];
    let editedTitle = page.title;
    let editedMeta = page.meta_description;

    const model = "claude-opus-4-7";
    const maxTokens = 6000;
    const msgs = [{ role: "user" as const, content: userMessage }];
    const t0 = Date.now();

    try {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        tools: [{
          name: "update_page",
          description: "Apply the edits and return the complete updated page sections.",
          input_schema: inputSchema as { type: "object"; properties: Record<string, unknown> },
        }],
        tool_choice: { type: "tool", name: "update_page" },
        system: systemPrompt,
        messages: msgs,
      }, { timeout: 90_000 });

      void logAiCall({
        siteId: id,
        operation: "page_ai_edit",
        model,
        maxTokens,
        systemPrompt,
        messages: msgs,
        response: msg,
        durationMs: Date.now() - t0,
      });

      const toolUse = msg.content.find(c => c.type === "tool_use");
      if (!toolUse || toolUse.type !== "tool_use") {
        return reply.internalServerError("AI did not return a tool_use block.");
      }

      const input = toolUse.input as { sections?: unknown[]; title?: string; meta_description?: string };
      editedSections = Array.isArray(input.sections) ? input.sections : page.sections;
      if (input.title) editedTitle = input.title;
      if (input.meta_description) editedMeta = input.meta_description ?? "";
    } catch (err) {
      return reply.internalServerError(`AI edit failed: ${(err as Error).message}`);
    }

    const parsedSections = z.array(sectionSchema).safeParse(editedSections);
    if (!parsedSections.success) {
      return reply.internalServerError(`AI returned invalid sections: ${parsedSections.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }

    const newPages = [...specData.pages];
    newPages[pageIndex] = {
      ...page,
      title: editedTitle,
      meta_description: editedMeta,
      sections: parsedSections.data,
    };

    const newSpec = { ...specData, pages: newPages };
    const parsed = specSchema.safeParse(newSpec);
    if (!parsed.success) {
      return reply.internalServerError(`Invalid spec after edit: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }

    const now = new Date();
    const updated = await db
      .updateTable("sites")
      .set({ spec: JSON.stringify(parsed.data), updated_at: now, draft_updated_at: now })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });
};
