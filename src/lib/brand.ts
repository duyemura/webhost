import crypto from "node:crypto";
import { load } from "cheerio";
import { anthropic } from "./anthropic.js";
import { db } from "../db/client.js";
import { storeAsset } from "./storage.js";
import { isPublicUrl } from "./scrape.js";
import type { AllowedMimeType } from "../db/types.js";
import { logAiCall } from "./ai-logger.js";

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

/**
 * Apply brand kit onto a theme preset.
 *
 * What the theme owns (never overridden):
 * - Typography structure: heading_weight, heading_transform, heading_scale,
 *   heading_tracking — the style choices that define the theme's character.
 *   "Bold" means 900-weight uppercase xl headings regardless of font family.
 * - Background mode: dark themes keep their dark canvas; the brand color
 *   appears as the CTA/accent on top of it.
 * - Structural neutrals: muted, border, surface — calibrated for the
 *   background mode.
 *
 * What the brand kit owns:
 * - Primary action color, primary_foreground, accent — the gym's real brand.
 * - Font families, when the brand has a real font preference (i.e. not the
 *   generic Inter fallback). A serif-branded gym choosing "Bold" should get
 *   bold structure with their serif face, not Barlow Condensed.
 */
export function applyBrandKitToTheme(
  theme: import("../blocks/types.js").Theme,
  brandKit: BrandKit,
): import("../blocks/types.js").Theme {
  const hasBrandHeadingFont = brandKit.heading_font && brandKit.heading_font !== DEFAULT_BRAND_KIT.heading_font;
  const hasBrandBodyFont = brandKit.body_font && brandKit.body_font !== DEFAULT_BRAND_KIT.body_font;

  return {
    ...theme,
    colors: {
      ...theme.colors,
      primary: brandKit.primary,
      primary_foreground: brandKit.primary_foreground,
      accent: brandKit.accent,
    },
    typography: {
      ...theme.typography,
      // Font families come from the brand when a real brand font was found.
      // Structural choices (weight, transform, scale, tracking) always stay
      // with the theme — they define the aesthetic, not the font.
      ...(hasBrandHeadingFont ? { heading_font: brandKit.heading_font } : {}),
      ...(hasBrandBodyFont ? { body_font: brandKit.body_font } : {}),
    },
  };
}

interface BrandSignals {
  theme_color: string | null;
  ms_tile_color: string | null;
  logo_candidates: string[];
  favicon_url: string | null;
  og_image: string | null;
  hero_style_colors: string[];
  google_fonts: string[];       // font family names found in Google Fonts <link> tags
  css_font_families: string[];  // font-family values found in :root / body CSS rules
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

  // Extract font family names from Google Fonts <link> tags
  const googleFonts: string[] = [];
  $("link[href*='fonts.googleapis.com'], link[href*='fonts.gstatic.com']").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    // family=Font+Name:wght@... or family=Font+Name&...
    const matches = [...href.matchAll(/family=([A-Za-z0-9+]+)/g)];
    for (const m of matches) {
      const name = m[1]!.replace(/\+/g, " ");
      if (name && !googleFonts.includes(name)) googleFonts.push(name);
    }
  });

  // Extract font-family values from :root and body CSS rules
  const cssFontFamilies: string[] = [];
  $("style").each((_, el) => {
    const css = $(el).text();
    // Only look in :root and body rules to avoid noise from component fonts
    const rootBodyBlocks = css.match(/(?::root|body)\s*\{[^}]+\}/g) ?? [];
    for (const block of rootBodyBlocks) {
      // New regex per block — /g flag regex retains lastIndex across exec() calls
      const fontFamilyRe = /font-family\s*:\s*['"]?([A-Za-z0-9 ]+)['"]?/gi;
      let m: RegExpExecArray | null;
      while ((m = fontFamilyRe.exec(block)) !== null) {
        const name = m[1]!.trim();
        if (name && name.toLowerCase() !== "sans-serif" && name.toLowerCase() !== "serif"
          && name.toLowerCase() !== "monospace" && !cssFontFamilies.includes(name)) {
          cssFontFamilies.push(name);
        }
      }
    }
  });

  return {
    theme_color,
    ms_tile_color,
    logo_candidates: [...new Set(logo_candidates)].slice(0, 5),
    favicon_url,
    og_image,
    hero_style_colors: [...new Set(heroStyleColors)].slice(0, 12),
    google_fonts: googleFonts.slice(0, 5),
    css_font_families: cssFontFamilies.slice(0, 5),
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
  "heading_font": "Font Name or null",  // Google Fonts name ONLY if found in the font signals — otherwise null
  "body_font": "Font Name or null",     // Google Fonts name ONLY if found in the font signals — otherwise null
  "logo_url": "url or null"       // pick the best logo URL from candidates, or null
}

Rules:
- Prioritize the theme-color and inline colors found — they represent the real brand palette
- If no colors found, use neutral professional defaults (#111827 primary, white background)
- heading_font / body_font: ONLY return a font name when it appears in the Google Fonts links or CSS
  font-family signals. If no fonts were found, return null — do NOT guess or invent a font name.
- When fonts are found, the value must be an exact Google Fonts family name (e.g. "Montserrat")
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
- Favicon: ${signals.favicon_url ?? "none"}
- Google Fonts loaded: ${signals.google_fonts.length > 0 ? signals.google_fonts.join(", ") : "none"}
- CSS font-family in :root/body: ${signals.css_font_families.length > 0 ? signals.css_font_families.join(", ") : "none"}`;

  let kit: BrandKit = { ...DEFAULT_BRAND_KIT };

  try {
    const model = "claude-haiku-4-5-20251001";
    const maxTokens = 500;
    const msgs = [{ role: "user" as const, content: prompt }];
    const t0 = Date.now();
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      system: BRAND_SYSTEM_PROMPT,
      messages: msgs,
    });
    void logAiCall({
      siteId,
      operation: "brand_kit",
      model,
      maxTokens,
      systemPrompt: BRAND_SYSTEM_PROMPT,
      messages: msgs,
      response: msg,
      durationMs: Date.now() - t0,
    });

    const text = msg.content.find(c => c.type === "text")?.text ?? "";
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? "{}") as Partial<BrandKit & { logo_url: string } & { heading_font: string | null; body_font: string | null }>;

    kit = sanitizeBrandKit({
      logo_url: null,
      favicon_url: null,
      primary: json.primary ?? DEFAULT_BRAND_KIT.primary,
      primary_foreground: json.primary_foreground ?? DEFAULT_BRAND_KIT.primary_foreground,
      secondary: json.secondary ?? DEFAULT_BRAND_KIT.secondary,
      background: json.background ?? DEFAULT_BRAND_KIT.background,
      foreground: json.foreground ?? DEFAULT_BRAND_KIT.foreground,
      accent: json.accent ?? DEFAULT_BRAND_KIT.accent,
      // null means "no font found" — fall back to the Inter default so
      // applyBrandKitToTheme treats it as "no brand font, use theme font"
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
