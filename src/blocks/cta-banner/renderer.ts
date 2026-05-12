import type { Theme, SiteCta } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";
import { diEyebrow, diHeadlineLines } from "../../render/di-helpers.js";

interface CtaBannerFields {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  cta_primary: { text: string; url: string };
  cta_secondary?: { text: string; url: string };
  layout?: "horizontal" | "centered";
}

export function render(section: Record<string, unknown>, theme: Theme, profile: BusinessProfile | null, siteCta?: SiteCta): string {
  if (theme.style_hint === "dark-industrial") return renderDI(section, profile, siteCta);
  return renderDefault(section, profile, siteCta);
}

function renderDefault(section: Record<string, unknown>, profile: BusinessProfile | null, siteCta?: SiteCta): string {
  const s = section as unknown as CtaBannerFields;
  const primaryUrl = siteCta?.url ?? s.cta_primary.url;

  return `<section class="block-cta-banner">
  <div class="container">
    <div class="block-cta-banner__inner">
      <div class="block-cta-banner__text">
        <h2>${esc(interpolate(s.headline, profile))}</h2>
        ${s.subheadline ? `<p>${esc(interpolate(s.subheadline, profile))}</p>` : ""}
      </div>
      <div class="block-cta-banner__actions">
        <a href="${esc(primaryUrl)}" class="btn-primary">${esc(s.cta_primary.text)}</a>
        ${s.cta_secondary ? `<a href="${esc(s.cta_secondary.url)}" class="btn-secondary">${esc(s.cta_secondary.text)}</a>` : ""}
      </div>
    </div>
  </div>
</section>`;
}

function renderDI(section: Record<string, unknown>, profile: BusinessProfile | null, siteCta?: SiteCta): string {
  const s = section as unknown as CtaBannerFields;
  const primaryUrl = siteCta?.url ?? s.cta_primary.url;
  const centered = s.layout === "centered";
  const cls = `block-cta-banner block-cta-banner--di${centered ? " block-cta-banner--centered" : ""}`;
  const headlineHtml = diHeadlineLines(interpolate(s.headline, profile));
  const eyebrowEl = s.eyebrow ? `${diEyebrow(interpolate(s.eyebrow, profile))}\n        ` : "";

  return `<section class="${cls}">
  <div class="container">
    <div class="block-cta-banner__inner">
      <div class="block-cta-banner__text">
        ${eyebrowEl}<h2>${headlineHtml}</h2>
        ${s.subheadline ? `<p>${esc(interpolate(s.subheadline, profile))}</p>` : ""}
      </div>
      <div class="block-cta-banner__actions">
        <a href="${esc(primaryUrl)}" class="btn-primary">${esc(s.cta_primary.text)}</a>
        ${s.cta_secondary ? `<a href="${esc(s.cta_secondary.url)}" class="btn-secondary">${esc(s.cta_secondary.text)}</a>` : ""}
      </div>
    </div>
  </div>
</section>`;
}
