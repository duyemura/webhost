import type { Site, BusinessProfile } from "../db/types.js";
import { config } from "../config.js";
import { esc } from "./escape.js";

export function siteBaseUrl(site: Pick<Site, "slug" | "custom_domain">): string {
  if (site.custom_domain) return `https://${site.custom_domain}`;
  return `https://${site.slug}.${config.baseDomain}`;
}

export function buildSeoSnippets(
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
      tags.push(`<meta property="og:title" content="${esc(titleText)}">`);
    }
    if (missing('name="twitter:title"')) {
      tags.push(`<meta name="twitter:title" content="${esc(titleText)}">`);
    }
  }

  if (profile?.description) {
    if (missing('name="description"')) {
      tags.push(`<meta name="description" content="${esc(profile.description)}">`);
    }
    if (missing('property="og:description"')) {
      tags.push(`<meta property="og:description" content="${esc(profile.description)}">`);
    }
    if (missing('name="twitter:description"')) {
      tags.push(`<meta name="twitter:description" content="${esc(profile.description)}">`);
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
