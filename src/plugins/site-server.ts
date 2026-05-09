import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import path from "node:path";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { getFile, listFiles } from "../lib/r2.js";
import { buildHeadSnippets, buildBodySnippets } from "../scripts/index.js";
import type { Script, Site, BusinessProfile } from "../db/types.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

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

function siteBaseUrl(site: Pick<Site, "slug" | "custom_domain">): string {
  if (site.custom_domain) return `https://${site.custom_domain}`;
  return `https://${site.slug}.${config.baseDomain}`;
}

function buildSeoSnippets(
  site: Pick<Site, "slug" | "custom_domain">,
  profile: BusinessProfile | null,
  html: string,
  requestPath: string
): string {
  const base = siteBaseUrl(site);
  const pageUrl = requestPath === "/" ? base : `${base}${requestPath}`;
  const tags: string[] = [];

  function missing(needle: string) {
    return !html.toLowerCase().includes(needle.toLowerCase());
  }

  if (missing('rel="canonical"')) {
    tags.push(`<link rel="canonical" href="${pageUrl}">`);
  }
  if (missing('property="og:url"')) {
    tags.push(`<meta property="og:url" content="${pageUrl}">`);
  }
  if (missing('property="og:type"')) {
    tags.push(`<meta property="og:type" content="website">`);
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titleText = titleMatch?.[1]?.trim() ?? profile?.biz_name ?? "";

  if (titleText) {
    if (missing('property="og:title"')) {
      tags.push(`<meta property="og:title" content="${titleText.replace(/"/g, "&quot;")}">`);
    }
    if (missing('name="twitter:title"')) {
      tags.push(`<meta name="twitter:title" content="${titleText.replace(/"/g, "&quot;")}">`);
    }
  }

  if (profile?.description) {
    if (missing('name="description"')) {
      tags.push(`<meta name="description" content="${profile.description.replace(/"/g, "&quot;")}">`);
    }
    if (missing('property="og:description"')) {
      tags.push(`<meta property="og:description" content="${profile.description.replace(/"/g, "&quot;")}">`);
    }
    if (missing('name="twitter:description"')) {
      tags.push(`<meta name="twitter:description" content="${profile.description.replace(/"/g, "&quot;")}">`);
    }
  }

  if (missing('name="twitter:card"')) {
    tags.push(`<meta name="twitter:card" content="summary_large_image">`);
  }

  if (profile?.biz_name) {
    const ld: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: profile.biz_name,
      url: base,
    };
    if (profile.description) ld.description = profile.description;
    if (profile.phone) ld.telephone = profile.phone;
    if (profile.email) ld.email = profile.email;
    if (profile.address || profile.city || profile.state || profile.zip) {
      ld.address = {
        "@type": "PostalAddress",
        ...(profile.address ? { streetAddress: profile.address } : {}),
        ...(profile.city ? { addressLocality: profile.city } : {}),
        ...(profile.state ? { addressRegion: profile.state } : {}),
        ...(profile.zip ? { postalCode: profile.zip } : {}),
        addressCountry: profile.country,
      };
    }
    if (profile.hours) ld.openingHours = profile.hours;
    if (missing('"LocalBusiness"')) {
      tags.push(`<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
    }
  }

  return tags.join("\n");
}

async function buildSitemap(
  site: Pick<Site, "slug" | "custom_domain">,
  siteId: string
): Promise<string> {
  const base = siteBaseUrl(site);
  const files = await listFiles(`sites/${siteId}/`);
  const htmlKeys = files.filter((f) => f.key.endsWith(".html")).map((f) => f.key);

  const urls = htmlKeys.map((key) => {
    const relativePath = key.replace(`sites/${siteId}/`, "");
    const loc =
      relativePath === "index.html"
        ? base
        : `${base}/${relativePath.replace(/\/index\.html$/, "").replace(/\.html$/, "")}`;
    return `  <url><loc>${loc}</loc></url>`;
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}


async function serveSite(
  site: Pick<Site, "id" | "slug" | "custom_domain">,
  requestUrl: string,
  reply: any
): Promise<void> {
  const requestPath = requestUrl.split("?")[0];

  // Serve sitemap inline
  if (requestPath === "/sitemap.xml") {
    const xml = await buildSitemap(site, site.id);
    reply.header("Content-Type", "application/xml; charset=utf-8").send(xml);
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

  const decodedPath = decodeURIComponent(requestPath);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "").replace(/^\//, "");
  const base = `sites/${site.id}`;

  const candidates = [
    `${base}/${safePath}`,
    `${base}/${safePath}/index.html`,
    `${base}/index.html`,
  ];

  for (const key of candidates) {
    // Build SEO snippet lazily using the HTML content
    const file = await getFile(key);
    if (!file) continue;
    const ext = path.extname(key).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? file.contentType;
    if (ext === ".html") {
      let html = file.body.toString("utf-8");
      const seoSnippet = buildSeoSnippets(site, profile ?? null, html, requestPath);
      const head = buildHeadSnippets(scripts);
      const body = buildBodySnippets(scripts);
      if (seoSnippet) html = html.replace("</head>", `${seoSnippet}\n</head>`);
      if (head) html = html.replace("</head>", `${head}\n</head>`);
      if (body) html = html.replace("</body>", `${body}\n</body>`);
      reply.header("Content-Type", contentType).send(html);
    } else {
      reply.header("Content-Type", contentType).send(file.body);
    }
    return;
  }

  reply.header("Content-Type", "text/html; charset=utf-8");
  reply.status(404).send(NOT_FOUND_HTML);
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

    // Path 1: subdomain match — {slug}.localhost (or configured baseDomain)
    const slug = getSiteSlug(hostname, config.baseDomain);
    if (slug && !RESERVED_SLUGS.has(slug)) {
      const site = await db
        .selectFrom("sites")
        .select(["id", "slug", "custom_domain", "published_at"])
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

    // Path 2: custom domain match — owner-provided domain points here
    const site = await db
      .selectFrom("sites")
      .select(["id", "slug", "custom_domain", "published_at"])
      .where("custom_domain", "=", hostname)
      .executeTakeFirst();

    if (!site || !site.published_at) return; // not a known site — fall through to API/dashboard

    await serveSite(site, req.url, reply);
  });
};

// fp() breaks plugin encapsulation so the onRequest hook runs for ALL requests
export const siteServer = fp(siteServerPlugin);
