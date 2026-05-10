import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";

interface CtaBannerFields {
  headline: string;
  subheadline?: string;
  cta_primary: { text: string; url: string };
  cta_secondary?: { text: string; url: string };
}

export function render(section: Record<string, unknown>, _theme: Theme, profile: BusinessProfile | null): string {
  const s = section as unknown as CtaBannerFields;

  return `<section class="block-cta-banner">
  <div class="container">
    <div class="block-cta-banner__inner">
      <div class="block-cta-banner__text">
        <h2>${esc(interpolate(s.headline, profile))}</h2>
        ${s.subheadline ? `<p>${esc(interpolate(s.subheadline, profile))}</p>` : ""}
      </div>
      <div class="block-cta-banner__actions">
        <a href="${esc(s.cta_primary.url)}" class="btn-primary">${esc(s.cta_primary.text)}</a>
        ${s.cta_secondary ? `<a href="${esc(s.cta_secondary.url)}" class="btn-secondary">${esc(s.cta_secondary.text)}</a>` : ""}
      </div>
    </div>
  </div>
</section>`;
}
