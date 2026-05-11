import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { specSchema } from "./schemas.js";
import { anthropic } from "../lib/anthropic.js";
import { registry } from "../blocks/index.js";
import { THEME_PRESETS } from "../render/theme-presets.js";
import { DEFAULT_THEME } from "../blocks/types.js";
import { scrapeWebsite } from "../lib/scrape.js";
import type { ScrapeResult, ScrapedPage } from "../lib/scrape.js";
import { extractBrandSignals, extractBrandKit, applyBrandKitToTheme, downloadSiteImage } from "../lib/brand.js";
import type { NewBusinessProfile, BusinessProfileUpdate } from "../db/types.js";
import { logAiCall, logCostEvent } from "../lib/ai-logger.js";
import { fetchInstructions, mergeInstructions } from "../lib/block-instructions.js";

const gmbProfileSchema = z.object({
  biz_name: z.string().max(200).optional(),
  phone: z.string().max(50).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  country: z.string().max(10).nullable().optional(),
  website_url: z.string().max(500).nullable().optional(),
  hours: z.string().max(1000).nullable().optional(),
  gmb_rating: z.number().min(1).max(5).nullable().optional(),
  gmb_review_count: z.number().int().min(0).nullable().optional(),
  gmb_reviews: z.array(z.object({
    author: z.string(),
    rating: z.number(),
    text: z.string(),
  })).nullable().optional(),
});

const bodySchema = z.object({
  url: z.string().url("Must be a valid URL"),
  theme_preset: z.string().optional(),
  gmb_profile: gmbProfileSchema.optional(),
});

const PAGE_SYSTEM_PROMPT = `You are an expert web designer mapping a single page from an existing website into a block-based spec.

Guidelines:
- Map each scraped section to the best matching block type from the catalog.
- Prefer specific block types over rich-text. Only use rich-text when nothing else fits.
- Extract real content from the scraped text — headlines, copy, list items, button labels.
- Replace business name/phone/email/address with {{business.name}}, {{business.phone}}, {{business.email}}, {{business.address}}, {{business.hours}}, {{business.city}}, {{business.state}} tokens.
- Each section needs a unique string "id" field (short descriptive IDs like "hero1", "about1").
- Write a short meta_description (max 160 chars) that describes the page.
- In _gaps, list any content patterns you saw but couldn't represent well (e.g. "Interactive class schedule widget"). Leave empty if all sections mapped cleanly.
- Images: if the user message includes a "Downloaded images" list, those are real asset URLs — USE THEM. Rules:
  1. Hero background: set background: { style: 'image', value: '<url>' } — never leave a hero imageless if an image was downloaded from the header/hero area.
  2. Gallery: populate every images[] entry with a downloaded URL. If no downloaded images exist for this page, omit the gallery block.
  3. Programs/Team/About: assign downloaded images to items using alt text or section hint for matching. Distribute images across items when multiple exist.
  4. NEVER invent image URLs. Only use URLs from the Downloaded images list, or leave the field empty.
  5. A section marked [source: css background] is typically a hero or banner — use its URL in the hero background field.`;

export interface DownloadedImage {
  assetUrl: string;
  originalUrl: string;
  alt: string;
  pageSlug: string;
  sectionHint: string;
}

function buildPageUserMessage(page: ScrapedPage, siteName: string, images: DownloadedImage[]): string {
  const lines: string[] = [
    `Site: ${siteName}`,
    `Page: ${page.title || page.slug}`,
    `URL: ${page.url}`,
    `Sections found: ${page.sections.length}`,
    "",
  ];

  // Include downloaded images available for this page
  const pageImages = images.filter(img => img.pageSlug === page.slug);
  if (pageImages.length > 0) {
    lines.push("Downloaded images (use these URLs directly in image fields):");
    for (const img of pageImages) {
      const altNote = img.alt ? ` alt="${img.alt}"` : "";
      const hint = img.sectionHint === "css" ? "css background" : img.sectionHint;
      lines.push(`  ${img.assetUrl}${altNote} [source: ${hint}]`);
    }
    lines.push("");
  }

  for (const section of page.sections) {
    lines.push(`--- Section [${section.tag}] class="${section.class_hints}" ---`);
    if (section.heading) lines.push(`Heading: ${section.heading}`);
    if (section.subheading && section.subheading !== section.heading) lines.push(`Subheading: ${section.subheading}`);
    if (section.paragraphs.length > 0) lines.push(`Text: ${section.paragraphs.join(" | ")}`);
    if (section.buttons.length > 0) lines.push(`Buttons/CTAs: ${section.buttons.join(", ")}`);
    if (section.list_items.length > 0) lines.push(`List items: ${section.list_items.slice(0, 8).join(" | ")}`);
    const imageAlts = section.images.map(img => img.alt).filter(Boolean);
    if (imageAlts.length > 0) lines.push(`Images: ${imageAlts.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

function buildPageToolSchema(instructions: import("../lib/block-instructions.js").FetchedInstructions): object {
  const sectionTypes = registry.getTypes();
  const rawSchemas = registry.toAISchema();

  const { global: globalInstructions, byBlock } = instructions;

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
    ? `\n\nAdditional generation rules:\n${globalInstructions.map(i => `- ${i}`).join("\n")}`
    : "";

  return {
    type: "object",
    required: ["title", "nav_label", "meta_description", "sections"],
    properties: {
      title: { type: "string", description: "Full SEO page title (no site name suffix). For the home page (slug 'index'), use the business name or a short brand tagline — never the hero headline." },
      nav_label: { type: "string", description: "Short nav menu label — 1 to 3 words. Strip any city, state, or SEO decorators. 'CrossFit Classes in Denver, CO' → 'CrossFit'. 'About Our Gym in Kansas City' → 'About us'. 'Contact Us Today' → 'Contact'." },
      nav_group: { type: "string", description: "Optional dropdown group name. Set this to group related pages under a single nav dropdown. Example: all program pages get nav_group 'Programs'. Only set when 2+ pages share a clear category." },
      meta_description: { type: "string", description: "Max 160 chars" },
      sections: {
        type: "array",
        description: `Each section accepts an optional "bg" field:\n- "default" — brand background (white/light)\n- "muted" — light gray; use for every other section to break up the page\n- "dark" — near-black; use for 1–2 high-impact sections (CTA, stats, location)\n- "primary" — brand color; use for at most 1 section per page\nDo NOT leave every section as default — the page will look flat. Alternate muted/default at minimum.\n\nAvailable block types:\n${sectionDescriptions}${globalNote}`,
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
      _gaps: {
        type: "array",
        description: "Content patterns you couldn't map to any block type.",
        items: { type: "string" },
      },
    },
  };
}

function sanitizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/https?:\/\/[^\s]*/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "page";
}

function sseWrite(reply: import("fastify").FastifyReply, event: string, data: unknown) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

interface PageResult {
  slug: string;
  title: string;
  nav_label?: string;
  nav_group?: string;
  meta_description: string;
  sections: unknown[];
  gaps: string[];
  costEventId: string | null;
}

async function processPage(page: ScrapedPage, slug: string, siteName: string, images: DownloadedImage[], instructions: import("../lib/block-instructions.js").FetchedInstructions, siteId?: string): Promise<PageResult & { costEventId: string | null }> {
  const toolSchema = buildPageToolSchema(instructions);
  const userMessage = buildPageUserMessage(page, siteName, images);
  const model = "claude-sonnet-4-6";
  const maxTokens = 4000;
  const msgs = [{ role: "user" as const, content: userMessage }];

  const t0 = Date.now();
  const msg = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    tools: [{
      name: "create_page_spec",
      description: "Maps this page's scraped content into a structured block spec.",
      input_schema: toolSchema as { type: "object"; properties: Record<string, unknown> },
    }],
    tool_choice: { type: "tool", name: "create_page_spec" },
    system: PAGE_SYSTEM_PROMPT,
    messages: msgs,
  }, { timeout: 90_000 });
  const durationMs = Date.now() - t0;

  const costEventId = await logAiCall({
    siteId,
    operation: "import_page",
    model,
    maxTokens,
    systemPrompt: PAGE_SYSTEM_PROMPT,
    messages: msgs,
    response: msg,
    durationMs,
  });

  const toolUse = msg.content.find(c => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`AI did not return a spec for page "${page.title || slug}"`);
  }

  const input = toolUse.input as Record<string, unknown>;
  const gaps = Array.isArray(input._gaps) ? (input._gaps as string[]) : [];
  const sections = Array.isArray(input.sections) ? input.sections : [];

  return {
    slug,
    title: String(input.title ?? page.title ?? slug),
    nav_label: input.nav_label ? String(input.nav_label) : undefined,
    nav_group: input.nav_group ? String(input.nav_group) : undefined,
    meta_description: String(input.meta_description ?? ""),
    sections,
    gaps,
    costEventId,
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

    // Switch to SSE streaming
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // 1. Scrape with live events
    let scrape: ScrapeResult;
    try {
      scrape = await scrapeWebsite(body.data.url, (e) => {
        sseWrite(reply, e.type, e);
      });
    } catch (err) {
      sseWrite(reply, "error", { message: (err as Error).message });
      reply.raw.end();
      return reply;
    }

    // 2. Extract brand kit from home page HTML
    sseWrite(reply, "brand_start", {});
    let brandKit;
    try {
      const homeHtml = scrape.pages[0]?._html ?? "";
      const signals = extractBrandSignals(homeHtml, scrape.base_url, scrape.site_name);
      brandKit = await extractBrandKit(signals, id);
      sseWrite(reply, "brand_done", {
        logo: !!brandKit.logo_url,
        primary: brandKit.primary,
        heading_font: brandKit.heading_font,
      });
    } catch (err) {
      req.log.error({ err }, "brand extraction failed — continuing with default theme");
      brandKit = null;
      sseWrite(reply, "brand_done", { logo: false, primary: null, heading_font: null });
    }

    // 3. Harvest and download site images (cap 20 across all pages)
    const downloadedImages: DownloadedImage[] = [];
    const seenImageUrls = new Set<string>();
    const MAX_SITE_IMAGES = 20;

    sseWrite(reply, "images_start", {});
    const imageDownloadTasks: Array<() => Promise<void>> = [];

    for (const page of scrape.pages) {
      // Section-level images (inline img tags / inline background styles)
      for (const section of page.sections) {
        for (const image of section.images) {
          const originalUrl = image.src;
          if (seenImageUrls.has(originalUrl)) continue;
          if (imageDownloadTasks.length >= MAX_SITE_IMAGES) break;
          seenImageUrls.add(originalUrl);
          const alt = image.alt;
          const sectionHint = section.class_hints.split(" ")[0] || section.tag;
          const pageSlug = page.slug;
          imageDownloadTasks.push(async () => {
            const assetUrl = await downloadSiteImage(originalUrl, id);
            if (assetUrl) downloadedImages.push({ assetUrl, originalUrl, alt, pageSlug, sectionHint });
          });
        }
      }
      // Page-level images from CSS / preload hints (not tied to a section)
      for (const originalUrl of page.page_images) {
        if (seenImageUrls.has(originalUrl)) continue;
        if (imageDownloadTasks.length >= MAX_SITE_IMAGES) break;
        seenImageUrls.add(originalUrl);
        const pageSlug = page.slug;
        imageDownloadTasks.push(async () => {
          const assetUrl = await downloadSiteImage(originalUrl, id);
          if (assetUrl) downloadedImages.push({ assetUrl, originalUrl, alt: "", pageSlug, sectionHint: "css" });
        });
      }
    }

    // Download in parallel batches of 5
    const totalImageTasks = imageDownloadTasks.length;
    for (let i = 0; i < imageDownloadTasks.length; i += 5) {
      await Promise.all(imageDownloadTasks.slice(i, i + 5).map(t => t()));
    }

    sseWrite(reply, "images_done", { count: downloadedImages.length, failed: totalImageTasks - downloadedImages.length });

    // 4. Build each page individually so we can emit per-page progress
    const instructions = await fetchInstructions();
    sseWrite(reply, "ai_start", { pages: scrape.pages.length });

    const pageResults: PageResult[] = [];
    const allGaps: string[] = [];

    for (let i = 0; i < scrape.pages.length; i++) {
      const page = scrape.pages[i];
      const slug = i === 0 ? "index" : sanitizeSlug(page.slug || `page-${i}`);
      // Use the first section heading as the short page label — it's usually the clean page name
      // (avoids SEO-decorated titles like "CrossFit Classes in Overland Park, KS | Site")
      const firstHeading = page.sections.find(s => s.heading)?.heading ?? "";
      const rawLabel = firstHeading || (page.title?.split(/[-|]/)[0] ?? slug);
      const label = rawLabel.slice(0, 40).trim() || slug;

      sseWrite(reply, "ai_page_start", { slug, label, index: i, total: scrape.pages.length });

      try {
        // Send periodic heartbeats so the SSE connection stays alive during long AI calls
        const heartbeat = setInterval(() => sseWrite(reply, "heartbeat", {}), 15_000);
        let result: PageResult;
        try {
          result = await processPage(page, slug, scrape.site_name, downloadedImages, instructions, id);
        } finally {
          clearInterval(heartbeat);
        }
        pageResults.push(result);
        allGaps.push(...result.gaps);
        sseWrite(reply, "ai_page_done", { slug, label: result.nav_label ?? label, blocks: result.sections.length, costEventId: result.costEventId });
      } catch (err) {
        sseWrite(reply, "error", { message: (err as Error).message });
        reply.raw.end();
        return reply;
      }
    }

    // 3. Assemble + validate full spec
    const specData = {
      version: 1,
      pages: pageResults.map(({ gaps: _g, costEventId: _c, ...p }) => p),
    };

    const parsed = specSchema.safeParse(specData);
    if (!parsed.success) {
      sseWrite(reply, "error", {
        message: `Invalid spec: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      });
      reply.raw.end();
      return reply;
    }

    const baseTheme = (body.data.theme_preset && THEME_PRESETS[body.data.theme_preset])
      ? THEME_PRESETS[body.data.theme_preset]
      : DEFAULT_THEME;

    // Apply brand colors onto the theme structure. Typography stays with the
    // theme — the user chose "Bold" for Barlow Condensed, not for the gym's
    // original font. Colors come from the brand kit.
    const theme = brandKit ? applyBrandKitToTheme(baseTheme, brandKit) : baseTheme;

    let updated;
    try {
      const now = new Date();
      updated = await db
        .updateTable("sites")
        .set({
          spec: JSON.stringify(parsed.data),
          theme: JSON.stringify(theme),
          theme_preset: body.data.theme_preset ?? null,
          brand_kit: brandKit ? JSON.stringify(brandKit) : null,
          generation_prompt: `Imported from ${body.data.url}`,
          updated_at: now,
          draft_updated_at: now,
          ...(site.published_at ? {} : { published_at: now }),
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      if (body.data.gmb_profile) {
        const p = body.data.gmb_profile;
        const profileFields = {
          biz_name: p.biz_name ?? null,
          phone: p.phone ?? null,
          address: p.address ?? null,
          city: p.city ?? null,
          state: p.state ?? null,
          zip: p.zip ?? null,
          country: p.country ?? "US",
          website_url: p.website_url ?? null,
          hours: p.hours ?? null,
          gmb_rating: p.gmb_rating ?? null,
          gmb_review_count: p.gmb_review_count ?? null,
          gmb_reviews: p.gmb_reviews ? JSON.stringify(p.gmb_reviews) : null,
        };
        const existing = await db
          .selectFrom("business_profiles")
          .select("id")
          .where("site_id", "=", id)
          .executeTakeFirst();

        if (existing) {
          await db.updateTable("business_profiles")
            .set({ ...profileFields, updated_at: now } satisfies BusinessProfileUpdate)
            .where("site_id", "=", id)
            .execute();
        } else {
          await db.insertInto("business_profiles")
            .values({ site_id: id, ...profileFields } satisfies NewBusinessProfile)
            .execute();
        }
      }
    } catch (err) {
      sseWrite(reply, "error", { message: `Failed to save site: ${(err as Error).message}` });
      reply.raw.end();
      return reply;
    }

    const summary = {
      source_url: body.data.url,
      pages_scraped: scrape.pages.length,
      sections_found: scrape.pages.reduce((n, p) => n + p.sections.length, 0),
      pages_generated: parsed.data.pages.length,
      blocks_generated: parsed.data.pages.reduce((n, p) => n + p.sections.length, 0),
      gaps: [...new Set(allGaps)],
    };

    sseWrite(reply, "complete", { site: updated, summary });
    reply.raw.end();
    return reply;
  });
};
