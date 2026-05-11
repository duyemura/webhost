import crypto from "node:crypto";
import { load } from "cheerio";
import { anthropic } from "./anthropic.js";
import { db } from "../db/client.js";
import { storeAsset } from "./storage.js";
import { isPublicUrl } from "./scrape.js";
import type { AllowedMimeType } from "../db/types.js";

export interface BrandKit {
  logo_url: string | null;
  favicon_url: string | null;
  primary: string;
  primary_foreground: string;
  secondary: string;
  background: string;
  foreground: string;
  accent: string;
  heading_font: string;
  body_font: string;
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  logo_url: null,
  favicon_url: null,
  primary: "#111827",
  primary_foreground: "#ffffff",
  secondary: "#374151",
  background: "#ffffff",
  foreground: "#111111",
  accent: "#111827",
  heading_font: "Inter",
  body_font: "Inter",
};

interface BrandSignals {
  theme_color: string | null;
  ms_tile_color: string | null;
  logo_candidates: string[];
  favicon_url: string | null;
  og_image: string | null;
  hero_style_colors: string[];
  site_name: string;
  base_url: string;
}

const LOGO_IMAGE_MIMES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif",
]);

const FAVICON_MIMES = new Set([
  "image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/jpeg", "image/webp",
]);

const SITE_IMAGE_MIMES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
]);

function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function extractHexColors(text: string): string[] {
  const matches = text.match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  return [...new Set(matches)];
}

export function extractBrandSignals(homeHtml: string, baseUrl: string, siteName: string): BrandSignals {
  const $ = load(homeHtml);

  const theme_color = $("meta[name='theme-color']").attr("content") ?? null;
  const ms_tile_color = $("meta[name='msapplication-TileColor']").attr("content") ?? null;
  const og_image = $("meta[property='og:image']").attr("content") ?? null;

  const faviconHref =
    $("link[rel='icon'][href*='.png'], link[rel='icon'][href*='.svg']").first().attr("href") ??
    $("link[rel='icon']").first().attr("href") ??
    $("link[rel='shortcut icon']").first().attr("href") ??
    "/favicon.ico";
  const favicon_url = absoluteUrl(faviconHref, baseUrl);

  const logo_candidates: string[] = [];
  $("header img, nav img, [class*='logo'] img, [id*='logo'] img, img[class*='logo'], img[alt*='logo' i], img[alt*='brand' i]").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src");
    if (src) {
      const abs = absoluteUrl(src, baseUrl);
      if (abs) logo_candidates.push(abs);
    }
  });
  $("header svg, nav svg, [class*='logo'] svg").each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      const abs = absoluteUrl(src, baseUrl);
      if (abs && !logo_candidates.includes(abs)) logo_candidates.push(abs);
    }
  });

  const heroStyleColors: string[] = [];
  $("header, [class*='hero'], [class*='banner']").each((_, el) => {
    const style = $(el).attr("style") ?? "";
    heroStyleColors.push(...extractHexColors(style));
  });
  $("style").each((_, el) => {
    const css = $(el).text();
    if (css.includes(":root") || css.includes("--color") || css.includes("--primary")) {
      heroStyleColors.push(...extractHexColors(css).slice(0, 10));
    }
  });

  return {
    theme_color,
    ms_tile_color,
    logo_candidates: [...new Set(logo_candidates)].slice(0, 5),
    favicon_url,
    og_image,
    hero_style_colors: [...new Set(heroStyleColors)].slice(0, 12),
    site_name: siteName,
    base_url: baseUrl,
  };
}

async function downloadImageAsset(
  imageUrl: string,
  siteId: string,
  prefix: string,
  allowedMimes: Set<string>,
  maxBytes = 5 * 1024 * 1024,
): Promise<string | null> {
  if (!isPublicUrl(imageUrl)) return null;
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
    });
    if (!res.ok) return null;

    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!allowedMimes.has(mime)) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > maxBytes) return null;

    const ext = mime.split("/")[1]!.replace("jpeg", "jpg").replace("x-icon", "ico").replace("vnd.microsoft.icon", "ico");
    const filename = `${prefix}-${crypto.randomUUID()}.${ext}`;

    const url = await storeAsset(siteId, filename, buffer, mime);

    await db.insertInto("assets").values({
      site_id: siteId,
      filename,
      original_name: `${prefix}.${ext}`,
      mime_type: mime as AllowedMimeType,
      size: buffer.byteLength,
    }).execute();

    return url;
  } catch (err) {
    console.warn({ err, imageUrl, siteId }, "image asset download failed — skipping");
    return null;
  }
}

function downloadLogoAsset(logoUrl: string, siteId: string): Promise<string | null> {
  return downloadImageAsset(logoUrl, siteId, "logo", LOGO_IMAGE_MIMES);
}

function downloadFaviconAsset(faviconUrl: string, siteId: string): Promise<string | null> {
  return downloadImageAsset(faviconUrl, siteId, "favicon", FAVICON_MIMES, 512 * 1024);
}

export function downloadSiteImage(imageUrl: string, siteId: string): Promise<string | null> {
  return downloadImageAsset(imageUrl, siteId, "img", SITE_IMAGE_MIMES);
}

const BRAND_SYSTEM_PROMPT = `You are a brand designer. Given brand signals extracted from a website, suggest a brand kit.

Return a JSON object with exactly these fields:
{
  "primary": "#hex",              // main brand/action color (buttons, links, CTAs)
  "primary_foreground": "#hex",   // readable text color on primary background
  "secondary": "#hex",            // secondary brand color
  "background": "#hex",           // page background (usually white or near-white, or dark for dark sites)
  "foreground": "#hex",           // main body text color
  "accent": "#hex",               // highlight/accent color (can equal primary)
  "heading_font": "Font Name",    // Google Fonts name for headings (e.g. "Montserrat", "Playfair Display", "Inter")
  "body_font": "Font Name",       // Google Fonts name for body text (e.g. "Inter", "Open Sans", "Lato")
  "logo_url": "url or null"       // pick the best logo URL from candidates, or null
}

Rules:
- Prioritize the theme-color and inline colors found — they represent the real brand palette
- If no colors found, use neutral professional defaults (#111827 primary, white background)
- heading_font and body_font must be real Google Fonts names
- primary_foreground must be readable on the primary background (#fff or #000 or near)
- Return ONLY valid JSON, no markdown, no explanation`;

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const SAFE_FONT = /^[A-Za-z0-9 ]+$/;

/** Sanitize AI-generated color/font fields against invalid or injected values. */
function sanitizeBrandKit(kit: BrandKit): BrandKit {
  const colorFields = ["primary", "primary_foreground", "secondary", "background", "foreground", "accent"] as const;
  const sanitized = { ...kit };
  for (const field of colorFields) {
    if (!HEX_COLOR.test(kit[field])) {
      sanitized[field] = DEFAULT_BRAND_KIT[field];
    }
  }
  if (!SAFE_FONT.test(kit.heading_font)) sanitized.heading_font = DEFAULT_BRAND_KIT.heading_font;
  if (!SAFE_FONT.test(kit.body_font)) sanitized.body_font = DEFAULT_BRAND_KIT.body_font;
  return sanitized;
}

export async function extractBrandKit(
  signals: BrandSignals,
  siteId: string,
): Promise<BrandKit> {
  const prompt = `Site: ${signals.site_name}
Base URL: ${signals.base_url}

Brand signals found:
- theme-color meta tag: ${signals.theme_color ?? "none"}
- MS tile color: ${signals.ms_tile_color ?? "none"}
- OG image: ${signals.og_image ?? "none"}
- Inline/CSS hex colors on header/hero: ${signals.hero_style_colors.length > 0 ? signals.hero_style_colors.join(", ") : "none"}
- Logo image candidates (in order of likelihood): ${signals.logo_candidates.length > 0 ? signals.logo_candidates.join("\n  ") : "none"}
- Favicon: ${signals.favicon_url ?? "none"}`;

  let kit: BrandKit = { ...DEFAULT_BRAND_KIT };

  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: BRAND_SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content.find(c => c.type === "text")?.text ?? "";
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Partial<BrandKit & { logo_url: string }>;

    kit = sanitizeBrandKit({
      logo_url: null,
      favicon_url: null,
      primary: json.primary ?? DEFAULT_BRAND_KIT.primary,
      primary_foreground: json.primary_foreground ?? DEFAULT_BRAND_KIT.primary_foreground,
      secondary: json.secondary ?? DEFAULT_BRAND_KIT.secondary,
      background: json.background ?? DEFAULT_BRAND_KIT.background,
      foreground: json.foreground ?? DEFAULT_BRAND_KIT.foreground,
      accent: json.accent ?? DEFAULT_BRAND_KIT.accent,
      heading_font: json.heading_font ?? DEFAULT_BRAND_KIT.heading_font,
      body_font: json.body_font ?? DEFAULT_BRAND_KIT.body_font,
    });

    const [logoUrl, faviconUrl] = await Promise.all([
      json.logo_url && typeof json.logo_url === "string"
        ? downloadLogoAsset(json.logo_url, siteId)
        : Promise.resolve(null),
      signals.favicon_url
        ? downloadFaviconAsset(signals.favicon_url, siteId)
        : Promise.resolve(null),
    ]);
    kit.logo_url = logoUrl;
    kit.favicon_url = faviconUrl;
  } catch (err) {
    console.warn({ err, siteId }, "brand kit extraction failed — using defaults");
  }

  return kit;
}
