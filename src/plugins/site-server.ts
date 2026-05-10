import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { db } from "../db/client.js";
import { config } from "../config.js";
import type { Site } from "../db/types.js";
import type { SiteSpec } from "../blocks/types.js";
import { buildSpecSitemap } from "../render/sitemap.js";
import { renderSpecPage } from "../render/pipeline.js";

const RESERVED_SLUGS = new Set(["app", "www", "api", "mail", "admin", "status"]);

function getSiteSlug(host: string, baseDomain: string): string | null {
  const hostname = host.split(":")[0];
  const suffix = `.${baseDomain}`;
  if (hostname.endsWith(suffix)) {
    const slug = hostname.slice(0, -suffix.length);
    if (slug && !slug.includes(".")) return slug;
  }
  return null;
}

async function serveSite(
  site: Pick<Site, "id" | "slug" | "custom_domain" | "spec" | "theme">,
  requestUrl: string,
  reply: any,
): Promise<void> {
  const requestPath = requestUrl.split("?")[0];

  if (requestPath === "/sitemap.xml" && site.spec) {
    const xml = buildSpecSitemap(site, site.spec as SiteSpec);
    reply.header("Content-Type", "application/xml; charset=utf-8").send(xml);
    return;
  }

  if (!site.spec) {
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.status(404).send(NOT_FOUND_HTML);
    return;
  }

  const [scripts, profile] = await Promise.all([
    db
      .selectFrom("scripts")
      .selectAll()
      .where("site_id", "=", site.id)
      .where("enabled", "=", true)
      .orderBy("created_at", "asc")
      .execute(),
    db
      .selectFrom("business_profiles")
      .selectAll()
      .where("site_id", "=", site.id)
      .executeTakeFirst(),
  ]);

  const html = await renderSpecPage(site, profile ?? null, scripts, requestPath);
  if (!html) {
    reply.header("Content-Type", "text/html; charset=utf-8");
    reply.status(404).send(NOT_FOUND_HTML);
    return;
  }
  reply.header("Content-Type", "text/html; charset=utf-8").send(html);
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><title>Site not found</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}
.box{text-align:center;color:#374151}.box h1{font-size:1.5rem;font-weight:600;margin-bottom:.5rem}
.box p{color:#6b7280;font-size:.875rem}</style></head>
<body><div class="box"><h1>Site not found</h1><p>This site hasn't been set up yet, or the address is incorrect.</p></div></body>
</html>`;

const siteServerPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (req, reply) => {
    const hostname = req.hostname;

    // Let API and static routes pass through unmodified
    if (req.url.startsWith("/api/") || req.url.startsWith("/assets/")) return;

    // Path 1: subdomain match — {slug}.localhost (or configured baseDomain)
    const slug = getSiteSlug(hostname, config.baseDomain);
    if (slug && !RESERVED_SLUGS.has(slug)) {
      const site = await db
        .selectFrom("sites")
        .select(["id", "slug", "custom_domain", "published_at", "spec", "theme"])
        .where("slug", "=", slug)
        .executeTakeFirst();

      if (!site || !site.published_at) {
        reply.header("Content-Type", "text/html; charset=utf-8");
        reply.status(404).send(NOT_FOUND_HTML);
        return;
      }

      await serveSite(site, req.url, reply);
      return;
    }

    // Path 2: custom domain match — serves the live (published) slot
    const site = await db
      .selectFrom("sites")
      .select(["id", "slug", "custom_domain", "published_at", "live_published_at", "spec", "theme"])
      .where("custom_domain", "=", hostname)
      .executeTakeFirst();

    if (!site || !site.live_published_at) return; // not a known site or not published to live

    await serveSite(site, req.url, reply);
  });
};

// fp() breaks plugin encapsulation so the onRequest hook runs for ALL requests
export const siteServer = fp(siteServerPlugin);
