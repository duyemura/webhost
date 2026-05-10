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
  image_url?: string;
  stats_bar?: { value: string; label: string }[];
}

export function render(section: Record<string, unknown>, theme: Theme, profile: BusinessProfile | null): string {
  if (theme.style_hint === "dark-industrial") return renderDI(section, profile);
  return renderDefault(section, profile);
}

function renderDefault(section: Record<string, unknown>, profile: BusinessProfile | null): string {
  const s = section as unknown as HeroFields;
  const bg = s.background;
  let cls = "block-hero";
  let style = "";

  if (bg?.style === "dark") {
    cls += " block-hero--dark";
  } else if (bg?.style === "image" && bg.value) {
    cls += " block-hero--image";
    style = ` style="background-image:url('${esc(bg.value)}')"`;
  } else if (bg?.style === "color" && bg.value) {
    style = ` style="background:${esc(bg.value)}"`;
  }

  return `<section class="${cls}"${style}>
  <div class="container">
    <div class="block-hero__content">
      <h1>${esc(interpolate(s.headline, profile))}</h1>
      ${s.subheadline ? `<p class="block-hero__sub">${esc(interpolate(s.subheadline, profile))}</p>` : ""}
      ${(s.cta_primary || s.cta_secondary) ? `<div class="block-hero__actions">
        ${s.cta_primary ? `<a href="${safeUrl(s.cta_primary.url)}" class="btn-primary">${esc(s.cta_primary.text)}</a>` : ""}
        ${s.cta_secondary ? `<a href="${safeUrl(s.cta_secondary.url)}" class="btn-secondary">${esc(s.cta_secondary.text)}</a>` : ""}
      </div>` : ""}
    </div>
  </div>
</section>`;
}

function renderDI(section: Record<string, unknown>, profile: BusinessProfile | null): string {
  const s = section as unknown as HeroFields;
  const eyebrowEl = s.eyebrow ? `${diEyebrow(interpolate(s.eyebrow, profile))}\n      ` : "";
  const headlineHtml = diHeadlineLines(interpolate(s.headline, profile), s.accent_words);

  const statsEl = s.stats_bar?.length ? `
      <div class="di-stats-bar">
        ${s.stats_bar.map(stat => `<div>
          <div class="di-stats-bar__value">${esc(stat.value)}</div>
          <div class="di-stats-bar__label">${esc(stat.label)}</div>
        </div>`).join("\n        ")}
      </div>` : "";

  return `<section class="block-hero block-hero--dark block-hero--di">
  <div class="container">
    <div class="block-hero__content">
      ${eyebrowEl}<h1>${headlineHtml}</h1>
      ${s.subheadline ? `<p class="block-hero__sub">${esc(interpolate(s.subheadline, profile))}</p>` : ""}
      ${(s.cta_primary || s.cta_secondary) ? `<div class="block-hero__actions">
        ${s.cta_primary ? `<a href="${safeUrl(s.cta_primary.url)}" class="btn-primary">${esc(s.cta_primary.text)}</a>` : ""}
        ${s.cta_secondary ? `<a href="${safeUrl(s.cta_secondary.url)}" class="btn-secondary">${esc(s.cta_secondary.text)}</a>` : ""}
      </div>` : ""}${statsEl}
    </div>
  </div>
</section>`;
}
