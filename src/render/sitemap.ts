import type { Site } from "../db/types.js";
import type { SiteSpec } from "../blocks/types.js";
import { siteBaseUrl } from "./seo.js";

export function buildSpecSitemap(
  site: Pick<Site, "slug" | "custom_domain">,
  spec: SiteSpec
): string {
  const base = siteBaseUrl(site);

  const urls = spec.pages.map(page => {
    const loc = page.slug === "index" ? base : `${base}/${page.slug}`;
    return `  <url><loc>${loc}</loc></url>`;
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}
