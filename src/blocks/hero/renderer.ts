import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { interpolate } from "../../render/interpolate.js";
import { esc, safeUrl } from "../../render/escape.js";
import { diEyebrow, diHeadlineLines } from "../../render/di-helpers.js";

interface HeroFields {
  eyebrow?: string;
  headline: string;
  accent_words?: string[];
  subheadline?: string;
  cta_primary?: { text: string; url: string };
  cta_secondary?: { text: string; url: string };
  background?: { style: "color" | "image" | "dark"; value?: string };
  background_video_url?: string;
  image_url?: string;
  stats_bar?: { value: string; label: string }[];
}

export function render(section: Record<string, unknown>, theme: Theme, profile: BusinessProfile | null): string {
  if (theme.style_hint === "dark-industrial") return renderDI(section, profile);
  return renderDefault(section, profile);
}

function ctaHtml(s: HeroFields): string {
  if (!s.cta_primary && !s.cta_secondary) return "";
  return `<div class="block-hero__actions">
        ${s.cta_primary ? `<a href="${safeUrl(s.cta_primary.url)}" class="btn-primary">${esc(s.cta_primary.text)}</a>` : ""}
        ${s.cta_secondary ? `<a href="${safeUrl(s.cta_secondary.url)}" class="btn-secondary">${esc(s.cta_secondary.text)}</a>` : ""}
      </div>`;
}

function mediaLayers(videoUrl: string | undefined, imageUrl: string | undefined): string {
  if (videoUrl) {
    return `<div class="block-hero__bg" aria-hidden="true">
    <video autoplay muted loop playsinline>
      <source src="${safeUrl(videoUrl)}" type="video/mp4">
    </video>
  </div>
  <div class="block-hero__overlay" aria-hidden="true"></div>`;
  }
  if (imageUrl) {
    return `<div class="block-hero__bg" aria-hidden="true">
    <img src="${esc(imageUrl)}" alt="" loading="eager">
  </div>
  <div class="block-hero__overlay" aria-hidden="true"></div>`;
  }
  return "";
}

function renderDefault(section: Record<string, unknown>, profile: BusinessProfile | null): string {
  const s = section as unknown as HeroFields;
  const bg = s.background;
  const hasMedia = !!(s.background_video_url || (bg?.style === "image" && bg.value));
  const videoUrl = s.background_video_url;
  const imageUrl = bg?.style === "image" ? bg.value : undefined;

  let cls = "block-hero";
  let inlineStyle = "";

  if (hasMedia) {
    cls += " block-hero--media";
  } else if (bg?.style === "dark") {
    cls += " block-hero--dark";
  } else if (bg?.style === "color" && bg.value) {
    inlineStyle = ` style="background:${esc(bg.value)}"`;
  }

  const content = `<div class="block-hero__content">
      <h1>${esc(interpolate(s.headline, profile))}</h1>
      ${s.subheadline ? `<p class="block-hero__sub">${esc(interpolate(s.subheadline, profile))}</p>` : ""}
      ${ctaHtml(s)}
    </div>`;

  return `<section class="${cls}"${inlineStyle}>
  ${mediaLayers(videoUrl, imageUrl)}
  <div class="container">
    ${content}
  </div>
</section>`;
}

function renderDI(section: Record<string, unknown>, profile: BusinessProfile | null): string {
  const s = section as unknown as HeroFields;
  const bg = s.background;
  const videoUrl = s.background_video_url;
  const imageUrl = bg?.style === "image" ? bg.value : undefined;
  const hasMedia = !!(videoUrl || imageUrl);

  const eyebrowEl = s.eyebrow ? `${diEyebrow(interpolate(s.eyebrow, profile))}\n      ` : "";
  const headlineHtml = diHeadlineLines(interpolate(s.headline, profile), s.accent_words);

  const statsEl = s.stats_bar?.length ? `
      <div class="di-stats-bar">
        ${s.stats_bar.map(stat => `<div>
          <div class="di-stats-bar__value">${esc(stat.value)}</div>
          <div class="di-stats-bar__label">${esc(stat.label)}</div>
        </div>`).join("\n        ")}
      </div>` : "";

  const cls = `block-hero block-hero--dark block-hero--di${hasMedia ? " block-hero--media" : ""}`;

  const content = `<div class="block-hero__content">
      ${eyebrowEl}<h1>${headlineHtml}</h1>
      ${s.subheadline ? `<p class="block-hero__sub">${esc(interpolate(s.subheadline, profile))}</p>` : ""}
      ${ctaHtml(s)}${statsEl}
    </div>`;

  return `<section class="${cls}">
  ${mediaLayers(videoUrl, imageUrl)}
  <div class="container">
    ${content}
  </div>
</section>`;
}
