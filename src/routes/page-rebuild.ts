import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { getCachedCrawl } from "../lib/crawl-cache.js";
import { fetchInstructions } from "../lib/block-instructions.js";
import { processPage, sanitizeSlug, type DownloadedImage } from "./import.js";
import type { ScrapedPage } from "../lib/scrape.js";
import { specSchema } from "./schemas.js";

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
};
