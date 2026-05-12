import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { specSchema } from "./schemas.js";
import { anthropic } from "../lib/anthropic.js";
import { registry } from "../blocks/index.js";
import { THEME_PRESETS } from "../render/theme-presets.js";
import { DEFAULT_THEME } from "../blocks/types.js";
import { scrapeWebsite } from "../lib/scrape.js";
import type { ScrapeResult, ScrapedPage, NavLink } from "../lib/scrape.js";
import { extractBrandSignals, extractBrandKit, applyBrandKitToTheme, downloadSiteImage } from "../lib/brand.js";
import type { NewBusinessProfile, BusinessProfileUpdate } from "../db/types.js";
import { logAiCall, logCostEvent } from "../lib/ai-logger.js";
import { fetchInstructions, mergeInstructions } from "../lib/block-instructions.js";
import { getCachedCrawl, setCachedCrawl } from "../lib/crawl-cache.js";

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
  gmb_place_id: z.string().max(300).nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
});

// Pages that should never be built as content pages — not just hidden from nav
const SKIP_BUILD_SLUG_RE = /\brequest\b|cancel|pause|freeze|suspend|billing|login|register|portal|waiver|liability/i;

/**
 * Remove operational pages and SEO-duplicate slug variants from the crawl list.
 * Keeps the home page (index 0) always, then deduplicates longer slug variants
 * that are just keyword-stuffed versions of shorter already-accepted pages.
 * Example: "about-babylon-crossfit-in-babylon-ny" is dropped when "about" exists.
 */
function filterBuildPages(pages: readonly ScrapedPage[]): ScrapedPage[] {
  const [home, ...rest] = pages;

  // First pass: determine accepted slugs using length-sorted order so shorter
  // (canonical) slugs beat longer SEO-variant duplicates in dedup checks.
  const byLength = [...rest].sort((a, b) => a.slug.length - b.slug.length);
  const acceptedSlugs: string[] = [];
  for (const page of byLength) {
    const slug = page.slug;
    if (SKIP_BUILD_SLUG_RE.test(slug)) continue;
    const isDuplicate = acceptedSlugs.some(acc =>
      slug.startsWith(acc + "-") || slug.startsWith(acc + "/")
    );
    if (!isDuplicate) acceptedSlugs.push(slug);
  }

  // Second pass: return pages in original nav order, filtered to accepted slugs.
  const acceptedSet = new Set(acceptedSlugs);
  return [home, ...rest.filter(p => acceptedSet.has(p.slug))];
}

const bodySchema = z.object({
  url: z.string().url("Must be a valid URL"),
  theme_preset: z.string().optional(),
  force_crawl: z.boolean().optional(),
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
- Nav exclusions: Privacy Policy, Terms of Use, Terms & Conditions, Cancellation Policy, Cookie Policy, Sitemap, any legal/policy pages, AND any operational/account pages (Pause Membership, Freeze Account, Member Portal, Login, Register, Waiver, FAQ) must NOT appear in nav. Generate them as pages but they will be linked from the footer only. Blog pages must also be excluded (no CMS exists).
- Nav order: if "Original nav menu order" is provided in the user message, assign nav_label exactly matching the original label for that page, and use the same relative ordering. Use the original nav labels verbatim (e.g. if the original says "About Us", use "About Us" not "About"). The only reordering allowed is grouping 2+ program/service pages under a Programs dropdown.
- Nav budget: AT MOST 4 top-level nav entries (standalone links + dropdown groups combined). The 5th slot is always the CTA button. A nav with 3 entries + CTA is ideal. Never create more than 2 dropdown groups.
- Drop-in / intro pages: these are SERVICES, not CTAs. If the gym offers drop-ins or a no-sweat intro, give them their own standalone page so people can learn about them — render them as regular nav links. The CTA button is handled separately by the system.
- Programs dropdown: ONLY use nav_group "Programs" for pages that represent a specific workout type, class format, or service (e.g. CrossFit, Olympic Lifting, Kids, Open Gym). Never put Schedule, Coaches, About, Pricing, or Contact inside Programs.
- Dropdowns require 2+ children: never assign nav_group to a page if it would be the only page in that group — use a standalone link instead.
- Contact pages: always generate a simple contact-form block (type: "contact-form") with fields for name, email, phone (optional), and message. Do not attempt to replicate embedded third-party form widgets.
- If the page appears to be a blog index or individual blog post, map it as a single rich-text block with a brief placeholder noting the blog will be managed separately.
- Images: if the user message includes a "Downloaded images" list, those are real asset URLs — USE THEM. Rules:
  1. Hero background: ONLY set a background image if a downloaded image is explicitly from the hero/header area (source: hero, header, or css background). Do NOT assign a random image to the hero just because images were downloaded. Leave hero background empty if no hero-specific image is available.
  2. Gallery: populate every images[] entry with a downloaded URL. If no downloaded images exist for this page, omit the gallery block.
  3. Programs/Team/About: assign downloaded images to items using alt text or section hint for matching. Distribute images across items when multiple exist.
  4. NEVER invent image URLs. Only use URLs from the Downloaded images list, or leave the field empty.
  5. A section marked [source: css background] is typically a hero or banner — use its URL in the hero background field.
- Marquee blocks: items must be short punchy quote snippets extracted from real customer reviews — just the memorable phrase, no stars, no attribution, no quotation marks. E.g. "Came in nervous, left obsessed" or "Best decision I ever made". Pull from the Top reviews in the business facts section. Never use program/service names as marquee items.
- Icons: every item in a features block MUST have an icon field. Choose from this list based on meaning: star, award, trophy, check, bolt, heart, muscle, fire, clock, users, dumbbell, target, shield, running, yoga, boxing, calendar, phone, email, chart, lock, support. Never leave icon empty.
- Placeholder content: if a team/coaches section has no scraped member names, generate 3–4 plausible placeholder coaches with realistic first+last names (not "Coach Name"), fitness-appropriate roles, and a 1–2 sentence bio. Leave photo_url empty. Same principle for programs — if no real programs found, generate 2–3 plausible ones matching the business type with real-sounding names. This is so the owner has something to edit rather than a blank block.
- Photo assignment — strict context matching: ONLY assign a downloaded image to a block when there is a clear contextual match between the image's alt text/section hint and the block content. Specific rules: (1) A food/nutrition image must NOT go in a hero, about, team, or general features block. (2) A team/coach photo must NOT go in a hero background or gallery. (3) A facility/interior photo should not go in a nutrition or program-specific block. (4) A CSS-background image from the homepage hero section should only be used as a hero background on that page. When there is any doubt, leave the image field empty — a blank field is better than a contextually wrong photo.
- Hero headline rules — THIS IS CRITICAL:
  1. Target 4–8 words. Shorter is often better but specificity beats brevity — a specific 7-word headline always beats a vague 4-word one. HARD MAXIMUM: 10 words.
  2. NEVER copy the original site's tagline or headline verbatim — source sites almost always have bloated, generic copy. Rewrite it.
  3. NEVER write multi-fragment stacked headlines ("MORE THAN JUST A GYM. A COMMUNITY THAT CHANGES." = terrible — two sentences, 11 words, breaks the layout). ONE idea only.
  4. Lead with the outcome the customer WANTS, not what the business does. "Get seriously strong." not "We offer CrossFit classes."
  5. Specificity converts: "Lose 15 lbs before summer." beats "Transform your body." every time.
  6. The subheadline (1 sentence, ≤12 words) handles detail and nuance — the headline only needs to create desire and stop the scroll.
  7. Good fitness hero headlines: "Earn it." / "Get seriously strong." / "Your first class is free." / "Stronger in 30 days or your money back." / "The gym that actually keeps you coming back." / "Built for people like you."
  8. Bad: "More Than Just a Gym." (cliché/vague), "We Help You Achieve Your Fitness Goals" (boring, business-centric), stacked fragments.`;

export interface DownloadedImage {
  assetUrl: string;
  originalUrl: string;
  alt: string;
  pageSlug: string;
  sectionHint: string;
}

interface GmbFacts {
  biz_name?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  hours?: string | null;
  gmb_rating?: number | null;
  gmb_review_count?: number | null;
  gmb_reviews?: { author: string; rating: number; text: string }[] | null;
  gmb_place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
}

interface BrandContext {
  tone?: string | null;
  primary_icp?: string | null;
  secondary_icp?: string | null;
  positioning?: string | null;
}

function buildPageUserMessage(page: ScrapedPage, siteName: string, images: DownloadedImage[], gmb?: GmbFacts, brand?: BrandContext, navLinks?: NavLink[]): string {
  const lines: string[] = [
    `Site: ${siteName}`,
    `Page: ${page.title || page.slug}`,
    `URL: ${page.url}`,
    `Sections found: ${page.sections.length}`,
    "",
  ];

  // Verified GMB facts — inject on every page so AI can reference real data
  if (gmb) {
    lines.push("Verified business facts (from Google Maps — use these as ground truth):");
    if (gmb.biz_name) lines.push(`  Business name: ${gmb.biz_name}`);
    if (gmb.address) lines.push(`  Address: ${gmb.address}`);
    if (gmb.city && gmb.state) lines.push(`  Location: ${gmb.city}, ${gmb.state}`);
    if (gmb.phone) lines.push(`  Phone: ${gmb.phone}`);
    if (gmb.hours) lines.push(`  Hours:\n${gmb.hours.split("\n").map(l => `    ${l}`).join("\n")}`);
    if (gmb.gmb_rating != null) lines.push(`  Google rating: ${gmb.gmb_rating.toFixed(1)} stars`);
    if (gmb.gmb_review_count != null) lines.push(`  Total reviews: ${gmb.gmb_review_count.toLocaleString()}`);
    if (gmb.gmb_reviews?.length) {
      lines.push("  Top reviews:");
      for (const r of gmb.gmb_reviews.slice(0, 3)) {
        const stars = "★".repeat(Math.min(5, Math.round(r.rating)));
        lines.push(`    ${stars} "${r.text.slice(0, 120)}"`);
      }
    }
    lines.push("Use {{business.name}}, {{business.phone}}, {{business.address}}, {{business.hours}}, {{business.city}}, {{business.state}} tokens for personalizable fields.");
    lines.push("");
  }

  // Brand voice + audience context — shapes how copy is written
  if (brand && (brand.tone || brand.primary_icp || brand.positioning)) {
    lines.push("Brand context (use this to shape copy tone and audience targeting):");
    if (brand.tone) lines.push(`  Tone: ${brand.tone}`);
    if (brand.positioning) lines.push(`  Positioning: ${brand.positioning}`);
    if (brand.primary_icp) lines.push(`  Primary audience: ${brand.primary_icp}`);
    if (brand.secondary_icp) lines.push(`  Secondary audience: ${brand.secondary_icp}`);
    lines.push("");
  }

  // Original nav order — AI should preserve these labels and ordering
  if (navLinks && navLinks.length > 0) {
    lines.push("Original nav menu order (preserve these labels and sequence exactly):");
    for (let i = 0; i < navLinks.length; i++) {
      lines.push(`  ${i + 1}. "${navLinks[i].label}" → /${navLinks[i].slug}`);
    }
    lines.push("");
  }

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
      nav_label: { type: "string", description: "Short nav menu label — 1 to 3 words. Strip any city, state, or SEO decorators. 'CrossFit Classes in Denver, CO' → 'CrossFit'. 'About Our Gym in Kansas City' → 'About us'. 'Contact Us Today' → 'Contact'. Privacy Policy → omit from nav (footer only). Terms of Use → omit (footer only). Cancellation → omit (footer only). Blog → omit (no CMS)." },
      nav_group: { type: "string", description: "Optional dropdown group name. Set this to group related pages under a single nav dropdown. Example: all program pages get nav_group 'Programs'. Only set when 2+ pages share a clear category. IMPORTANT: if you assign nav_group 'Coaches' to sub-pages, do NOT also create a standalone 'Coaches' page at the top level — that would duplicate the group. The group dropdown IS the nav entry." },
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

export function sanitizeSlug(raw: string): string {
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

// Build-progress shape stored in sites.build_progress
export interface BuildProgressPage {
  slug: string;
  label: string;
  status: "pending" | "active" | "done" | "error";
  blocks?: number;
  error?: string;
}

interface BuildProgress {
  phase: "scraping" | "brand" | "building" | null;
  phase_label: string | null;
  pages: BuildProgressPage[];
  started_at?: string; // ISO — used for stale build detection
}

async function writeBuildProgress(siteId: string, progress: BuildProgress): Promise<void> {
  try {
    await db.updateTable("sites")
      .set({ build_progress: JSON.stringify(progress) })
      .where("id", "=", siteId)
      .execute();
  } catch {
    // non-fatal — real-time SSE is the primary channel
  }
}

async function setBuildStatus(siteId: string, status: "building" | null, error?: string): Promise<void> {
  try {
    await db.updateTable("sites")
      .set({
        build_status: status,
        build_error: error ?? null,
        ...(status === null ? { build_progress: null } : {}),
      })
      .where("id", "=", siteId)
      .execute();
  } catch {
    // non-fatal
  }
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

export async function processPage(page: ScrapedPage, slug: string, siteName: string, images: DownloadedImage[], instructions: import("../lib/block-instructions.js").FetchedInstructions, gmb?: GmbFacts, brand?: BrandContext, siteId?: string, navLinks?: NavLink[]): Promise<PageResult & { costEventId: string | null }> {
  const toolSchema = buildPageToolSchema(instructions);
  const userMessage = buildPageUserMessage(page, siteName, images, gmb, brand, navLinks);
  const model = "claude-sonnet-4-6";
  // Home page (index) can have many scraped sections → needs more output budget.
  // Inner pages are typically smaller; 6000 is a comfortable ceiling for both.
  const maxTokens = 8000;
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
  }, { timeout: 120_000 });
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

  // If max_tokens was hit the SDK returns input:{} — surface this as a hard error
  // so we never silently store a page with 0 sections.
  if (msg.stop_reason === "max_tokens") {
    throw new Error(`Response cut off by token limit for page "${page.title || slug}" — try a page with fewer sections`);
  }

  const toolUse = msg.content.find(c => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`AI did not return a spec for page "${page.title || slug}"`);
  }

  const input = toolUse.input as Record<string, unknown>;
  const gaps = Array.isArray(input._gaps) ? (input._gaps as string[]) : [];
  const sections = Array.isArray(input.sections) ? (input.sections as Record<string, unknown>[]) : [];

  // Guard: if the AI returned no sections for a page with real content, something went wrong
  if (sections.length === 0 && page.sections.length >= 3) {
    throw new Error(`AI returned 0 sections for "${page.title || slug}" which had ${page.sections.length} scraped sections — the response may have been malformed`);
  }

  // Validation + auto-fix pass — catch common AI mistakes before spec is stored
  const validatedSections = autoFixSections(sections, slug);

  return {
    slug,
    title: String(input.title ?? page.title ?? slug),
    nav_label: input.nav_label ? String(input.nav_label) : undefined,
    nav_group: input.nav_group ? String(input.nav_group) : undefined,
    meta_description: String(input.meta_description ?? ""),
    sections: validatedSections,
    gaps,
    costEventId,
  };
}

/**
 * Auto-fix common AI spec mistakes before storage.
 * Mutates a copy — never throws. Issues are silent fixes, not hard errors.
 */
function autoFixSections(sections: Record<string, unknown>[], slug: string): Record<string, unknown>[] {
  return sections.map(s => {
    if (s.type !== "hero") return s;

    const hero = { ...s } as Record<string, unknown>;
    const bg = hero.background as { style?: string; value?: string } | undefined;
    const hasImage = (bg?.style === "image" && bg.value) || hero.image_url || hero.background_video_url;

    // Promote legacy "bg": "dark" field to the proper background object
    if (!hasImage && hero.bg === "dark" && bg?.style !== "dark") {
      hero.background = { style: "dark" };
    }

    // Hero with no background set at all: default to "dark" so white text is always readable.
    // Only trigger when background is entirely absent — don't overwrite valid AI-set styles.
    if (!hasImage && bg == null) {
      hero.background = { style: "dark" };
    }

    // Homepage hero must have a CTA — add a sensible default if missing
    if (slug === "index" && !hero.cta_primary) {
      hero.cta_primary = { text: "Get started", url: "/get-started" };
    }

    return hero;
  });
}

const GET_STARTED_SYSTEM_PROMPT = `You are an expert conversion designer building a lead capture page for a fitness business.

This is a /get-started page — the PRIMARY conversion destination for the entire site. Every CTA button links here.

Your goal: maximize lead form submissions from visitors who are interested but haven't committed yet.

Page structure (use exactly this order):
1. hero — Dark background. Short punchy headline about the free intro/trial session. Subheadline addresses the biggest fear (no experience needed, no pressure, no commitment). CTA primary goes to /get-started (same page anchor — leave as-is). NO image unless one is provided.
2. features — "What to expect in 3 steps": Book your free intro → Meet your coach → Start your journey. Keep each description to 1 sentence. Use icon names like "calendar", "users", "trophy".
3. contact-form — This is the actual lead capture. Headline: "Book your free intro session". Fields: name, email, phone. One sentence of reassurance under the headline.
4. reviews — 2–3 short genuine reviews about the welcoming experience or results. Pull from provided Google reviews. Emphasize "first day" or "I was nervous" type reviews if available.
5. cta-banner — Final nudge. Short headline, no subheadline needed.

Rules:
- Use {{business.name}}, {{business.phone}}, {{business.city}}, {{business.state}} tokens everywhere.
- nav_label must be "Get started" (exactly).
- This page is NOT in the nav dropdown — nav_label is used only for the CTA button.
- Tone: warm, direct, zero pressure. This page talks to someone on the fence.
- Do NOT include pricing, schedules, or program details — keep the focus entirely on taking the first step.`;

export async function buildGetStartedPage(siteName: string, instructions: import("../lib/block-instructions.js").FetchedInstructions, gmb?: GmbFacts, brand?: BrandContext, siteId?: string): Promise<Omit<PageResult, "gaps" | "slug" | "nav_label" | "nav_group">> {
  const toolSchema = buildPageToolSchema(instructions);

  const lines: string[] = [
    `Site: ${siteName}`,
    `Page: Get Started (conversion lead capture page)`,
    `URL: /get-started`,
    "",
    "Build a conversion-optimized /get-started page for this fitness business.",
    "This page captures leads via a contact form. The visitor has seen the site and is interested but hasn't committed.",
    "",
  ];

  if (gmb) {
    lines.push("Verified business facts:");
    if (gmb.biz_name) lines.push(`  Business name: ${gmb.biz_name}`);
    if (gmb.city && gmb.state) lines.push(`  Location: ${gmb.city}, ${gmb.state}`);
    if (gmb.phone) lines.push(`  Phone: ${gmb.phone}`);
    if (gmb.gmb_rating != null) lines.push(`  Google rating: ${gmb.gmb_rating.toFixed(1)} stars`);
    if (gmb.gmb_review_count != null) lines.push(`  Total reviews: ${gmb.gmb_review_count.toLocaleString()}`);
    if (gmb.gmb_reviews?.length) {
      lines.push("  Top reviews (pick the most welcoming/beginner-friendly ones for the reviews block):");
      for (const r of gmb.gmb_reviews.slice(0, 5)) {
        lines.push(`    ★ "${r.text.slice(0, 150)}"`);
      }
    }
    lines.push("Use {{business.name}}, {{business.phone}}, {{business.city}}, {{business.state}} tokens.");
    lines.push("");
  }

  if (brand && (brand.tone || brand.primary_icp || brand.positioning)) {
    lines.push("Brand context:");
    if (brand.tone) lines.push(`  Tone: ${brand.tone}`);
    if (brand.positioning) lines.push(`  Positioning: ${brand.positioning}`);
    if (brand.primary_icp) lines.push(`  Primary audience: ${brand.primary_icp}`);
    lines.push("");
  }

  const userMessage = lines.join("\n");
  const model = "claude-sonnet-4-6";
  const msgs = [{ role: "user" as const, content: userMessage }];

  const t0 = Date.now();
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 4000,
    tools: [{
      name: "create_page_spec",
      description: "Creates the get-started lead capture page spec.",
      input_schema: toolSchema as { type: "object"; properties: Record<string, unknown> },
    }],
    tool_choice: { type: "tool", name: "create_page_spec" },
    system: GET_STARTED_SYSTEM_PROMPT,
    messages: msgs,
  }, { timeout: 90_000 });
  const durationMs = Date.now() - t0;

  const costEventId = await logAiCall({
    siteId,
    operation: "import_page",
    model,
    maxTokens: 4000,
    systemPrompt: GET_STARTED_SYSTEM_PROMPT,
    messages: msgs,
    response: msg,
    durationMs,
  });

  const toolUse = msg.content.find(c => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("AI did not return get-started spec");

  const input = toolUse.input as Record<string, unknown>;
  const sections = Array.isArray(input.sections) ? (input.sections as Record<string, unknown>[]) : [];
  const fixed = autoFixSections(sections, "get-started");

  return {
    title: String(input.title ?? `Get Started — ${siteName}`),
    meta_description: String(input.meta_description ?? `Start your fitness journey at {{business.name}}. Book your free intro session — no experience needed, no commitment required.`),
    sections: fixed,
    costEventId,
  };
}

export function getStartedFallback(): { slug: string; title: string; nav_label: string; meta_description: string; sections: unknown[] } {
  return {
    slug: "get-started",
    title: "Get Started — {{business.name}}",
    nav_label: "Get started",
    meta_description: "Start your fitness journey at {{business.name}} in {{business.city}}. Book a free intro session — no experience needed, no commitment required.",
    sections: [
      {
        id: "gs-hero",
        type: "hero",
        background: { style: "dark" },
        headline: "Your first class is free",
        subheadline: "Come in, meet the coaches, and see if {{business.name}} is the right fit for you. No pressure. No commitment.",
        cta_primary: { text: "Book your free intro", url: "#gs-form" },
      },
      {
        id: "gs-steps",
        type: "features",
        bg: "muted",
        headline: "Here's how it works",
        items: [
          { icon: "calendar", title: "Book your intro", description: "Fill out the form below and we'll reach out within 24 hours to schedule your free session." },
          { icon: "users", title: "Meet the coaches", description: "Come in and see the facility. Our coaches will learn about your goals and show you around." },
          { icon: "trophy", title: "Start your journey", description: "We'll build a plan around your goals and get you started — at whatever pace works for you." },
        ],
      },
      {
        id: "gs-form",
        type: "contact-form",
        headline: "Book your free intro session",
        subheadline: "We'll reach out within 24 hours to confirm your spot. No commitment required.",
        fields: ["name", "email", "phone"],
      },
    ],
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

    // Mark build in progress — persists across reloads
    await setBuildStatus(id, "building");

    // Switch to SSE streaming
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Track progress state for DB writes
    const progress: BuildProgress = { phase: "scraping", phase_label: null, pages: [], started_at: new Date().toISOString() };

    // 1. Scrape — use cache if available (3-day TTL), unless force_crawl is set
    let scrape: ScrapeResult;
    const cachedScrape = body.data.force_crawl ? null : await getCachedCrawl(body.data.url);
    if (cachedScrape) {
      scrape = cachedScrape;
      sseWrite(reply, "scrape_cached", { pages: scrape.pages.length, url: body.data.url });
      progress.phase_label = `Using cached crawl — ${scrape.pages.length} pages`;
    } else {
      try {
        scrape = await scrapeWebsite(body.data.url, (e) => {
          sseWrite(reply, e.type, e);
        });
      } catch (err) {
        const msg = (err as Error).message;
        sseWrite(reply, "error", { message: msg });
        await setBuildStatus(id, null, msg);
        reply.raw.end();
        return reply;
      }
      void setCachedCrawl(body.data.url, scrape);
    }

    // 2. Extract brand kit from home page HTML
    progress.phase = "brand";
    progress.phase_label = "Extracting brand colors and logo…";
    void writeBuildProgress(id, progress);
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

    // 4. Filter scrape pages before building — remove junk, deduplicate SEO variants
    const buildPages = filterBuildPages(scrape.pages);

    // Build each page individually so we can emit per-page progress
    const instructions = await fetchInstructions();

    // Initialize page list in progress before AI starts
    const pageLabels: string[] = buildPages.map((page, i) => {
      const firstHeading = page.sections.find(s => s.heading)?.heading ?? "";
      const rawLabel = firstHeading || (page.title?.split(/[-|]/)[0] ?? `page-${i}`);
      return rawLabel.slice(0, 40).trim() || `page-${i}`;
    });
    progress.phase = "building";
    progress.phase_label = `0 of ${buildPages.length}`;
    progress.pages = buildPages.map((page, i) => ({
      slug: i === 0 ? "index" : sanitizeSlug(page.slug || `page-${i}`),
      label: pageLabels[i],
      status: "pending" as const,
    }));
    void writeBuildProgress(id, progress);
    sseWrite(reply, "ai_start", { pages: buildPages.length });

    const pageResults: PageResult[] = new Array(buildPages.length);
    const allGaps: string[] = [];

    // Prepare page tasks with stable slugs
    const pageTasks = buildPages.map((page, i) => ({
      page,
      i,
      slug: i === 0 ? "index" : sanitizeSlug(page.slug || `page-${i}`),
      label: pageLabels[i],
    }));

    // Process pages in parallel batches — 3 concurrent keeps us well under API rate limits
    const CONCURRENCY = 3;
    for (let batchStart = 0; batchStart < pageTasks.length; batchStart += CONCURRENCY) {
      const batch = pageTasks.slice(batchStart, batchStart + CONCURRENCY);

      // Mark batch as active and emit start events
      for (const { slug, label, i } of batch) {
        progress.pages[i] = { ...progress.pages[i], slug, label, status: "active" };
        sseWrite(reply, "ai_page_start", { slug, label, index: i, total: scrape.pages.length });
      }
      progress.phase_label = `${Math.min(batchStart + CONCURRENCY, pageTasks.length)} of ${pageTasks.length}`;
      void writeBuildProgress(id, progress);

      const heartbeat = setInterval(() => sseWrite(reply, "heartbeat", {}), 15_000);
      const batchSettled = await Promise.allSettled(
        batch.map(({ page, slug }) =>
          processPage(page, slug, scrape.site_name, downloadedImages, instructions, body.data.gmb_profile, brandKit ?? undefined, id, scrape.nav_links)
        )
      );
      clearInterval(heartbeat);

      // Record results and emit done/error events in batch order
      for (let j = 0; j < batch.length; j++) {
        const { slug, label, i } = batch[j];
        const settled = batchSettled[j];

        if (settled.status === "fulfilled") {
          const result = settled.value;
          pageResults[i] = result;
          allGaps.push(...result.gaps);
          const doneLabel = result.nav_label ?? label;
          progress.pages[i] = { slug, label: doneLabel, status: "done", blocks: result.sections.length };
          sseWrite(reply, "ai_page_done", { slug, label: doneLabel, blocks: result.sections.length, costEventId: result.costEventId });
        } else {
          // Page failed — insert a stub so the build can complete; it can be rebuilt individually
          req.log.error({ err: settled.reason, slug, siteId: id }, "page AI build failed");
          const errMsg = settled.reason instanceof Error ? settled.reason.message : String(settled.reason ?? "Unknown error");
          pageResults[i] = {
            slug,
            title: label,
            nav_label: label,
            meta_description: "",
            sections: [{ id: `stub-${slug}`, type: "rich-text", content: `<p><em>This page failed to build and needs to be rebuilt from the Pages tab.</em></p>` }],
            gaps: [],
            costEventId: null,
          };
          progress.pages[i] = { slug, label, status: "error", error: errMsg };
          sseWrite(reply, "ai_page_error", { slug, label, error: errMsg });
        }
      }
      void writeBuildProgress(id, progress);
    }

    // 3. Assemble + validate full spec
    const builtPages = pageResults.map(({ gaps: _g, costEventId: _c, ...p }) => p);

    // Always AI-build /get-started as a first-class conversion page.
    // It's the canonical CTA destination — every site needs it regardless of scrape content.
    if (!builtPages.some(p => p.slug === "get-started")) {
      progress.pages.push({ slug: "get-started", label: "Get started", status: "active" });
      sseWrite(reply, "ai_page_start", { slug: "get-started", label: "Get started", index: pageTasks.length, total: pageTasks.length + 1 });
      void writeBuildProgress(id, progress);

      try {
        const gsResult = await buildGetStartedPage(scrape.site_name, instructions, body.data.gmb_profile, brandKit ?? undefined, id);
        builtPages.push({ slug: "get-started", title: gsResult.title, nav_label: "Get started", meta_description: gsResult.meta_description, sections: gsResult.sections });
        const lastIdx = progress.pages.length - 1;
        progress.pages[lastIdx] = { slug: "get-started", label: "Get started", status: "done", blocks: gsResult.sections.length };
        sseWrite(reply, "ai_page_done", { slug: "get-started", label: "Get started", blocks: gsResult.sections.length, costEventId: gsResult.costEventId });
      } catch (err) {
        req.log.error({ err, siteId: id }, "get-started AI build failed — using hardcoded fallback");
        builtPages.push(getStartedFallback());
        const lastIdx = progress.pages.length - 1;
        progress.pages[lastIdx] = { slug: "get-started", label: "Get started", status: "done", blocks: 3 };
        sseWrite(reply, "ai_page_done", { slug: "get-started", label: "Get started", blocks: 3, costEventId: null, fallback: true });
      }
      void writeBuildProgress(id, progress);
    }

    const specData = {
      version: 1,
      pages: builtPages,
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

      // Every site has a canonical /get-started page — always set as CTA unless owner has overridden
      const existingSite = await db.selectFrom("sites").select(["cta_url", "cta_label"]).where("id", "=", id).executeTakeFirst();
      const ctaWrite = existingSite?.cta_url
        ? {} // owner has a custom CTA — don't overwrite
        : { cta_url: "/get-started", cta_label: "Get started" };

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
          build_status: null,
          ...ctaWrite,
          build_error: null,
          build_progress: null,
          ...(site.published_at ? {} : { published_at: now }),
        })
        .where("id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();

      // Always upsert a profile — GMB data when available, scraped fallback otherwise.
      // The social proof bar needs at least a profile row to render.
      {
        const p = body.data.gmb_profile;

        // Extract email via regex from all scraped page text (contact pages usually have one)
        const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
        let scrapedEmail: string | null = null;
        outer: for (const pg of scrape.pages) {
          for (const sec of pg.sections) {
            const text = [sec.heading, sec.subheading, ...sec.paragraphs, ...sec.list_items].join(" ");
            const m = text.match(EMAIL_RE);
            if (m) { scrapedEmail = m[0]; break outer; }
          }
        }

        // Description: brand kit positioning → homepage hero paragraph → null
        let scrapedDescription: string | null = null;
        if (brandKit?.positioning) {
          scrapedDescription = brandKit.positioning;
        } else {
          const hero = scrape.pages[0]?.sections[0];
          if (hero) {
            const heading = hero.heading || scrape.site_name;
            const para = hero.paragraphs[0] ?? "";
            scrapedDescription = para
              ? `${heading}. ${para}`.slice(0, 500)
              : (heading || null);
          }
        }

        const profileFields = {
          biz_name: p?.biz_name || scrape.site_name || null,
          description: scrapedDescription,
          email: scrapedEmail,
          phone: p?.phone ?? null,
          address: p?.address ?? null,
          city: p?.city ?? null,
          state: p?.state ?? null,
          zip: p?.zip ?? null,
          country: p?.country ?? "US",
          website_url: p?.website_url ?? body.data.url,
          hours: p?.hours ?? null,
          gmb_rating: p?.gmb_rating ?? null,
          gmb_review_count: p?.gmb_review_count ?? null,
          gmb_reviews: p?.gmb_reviews ? JSON.stringify(p.gmb_reviews) : null,
          gmb_place_id: p?.gmb_place_id ?? null,
          lat: p?.lat ?? null,
          lng: p?.lng ?? null,
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
      const msg = `Failed to save site: ${(err as Error).message}`;
      sseWrite(reply, "error", { message: msg });
      await setBuildStatus(id, null, msg);
      reply.raw.end();
      return reply;
    }

    const gmb = body.data.gmb_profile;
    const summary = {
      source_url: body.data.url,
      pages_scraped: scrape.pages.length,
      pages_built: buildPages.length,
      sections_found: buildPages.reduce((n, p) => n + p.sections.length, 0),
      pages_generated: parsed.data.pages.length,
      blocks_generated: parsed.data.pages.reduce((n, p) => n + p.sections.length, 0),
      gaps: [...new Set(allGaps)],
      logo_found: !!brandKit?.logo_url,
      brand_color: brandKit?.primary ?? null,
      brand_font: brandKit?.heading_font ?? null,
      images_downloaded: downloadedImages.length,
      gmb_rating: gmb?.gmb_rating ?? null,
      gmb_review_count: gmb?.gmb_review_count ?? null,
    };

    sseWrite(reply, "complete", { site: updated, summary });
    reply.raw.end();
    return reply;
  });
};
