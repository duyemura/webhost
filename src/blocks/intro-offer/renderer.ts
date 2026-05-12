import type { Theme, SiteCta } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface IntroOfferFields {
  headline: string;
  price: string;
  period?: string;
  details?: string;
  cta: { text: string; url: string };
}

export function render(section: Record<string, unknown>, theme: Theme, _profile: BusinessProfile | null, siteCta?: SiteCta): string {
  const s = section as unknown as IntroOfferFields;
  const di = theme.style_hint === "dark-industrial";
  const ctaUrl = siteCta?.url ?? s.cta.url;

  return `<section class="block-intro-offer${di ? " block-intro-offer--di" : ""}">
  <div class="container">
    <div class="block-intro-offer__inner">
      <h2>${esc(s.headline)}</h2>
      <div>
        <div class="block-intro-offer__price">${esc(s.price)}</div>
        ${s.period ? `<div class="block-intro-offer__period">${esc(s.period)}</div>` : ""}
      </div>
      ${s.details ? `<p class="block-intro-offer__details">${esc(s.details)}</p>` : ""}
      <a href="${esc(ctaUrl)}" class="btn-secondary">${esc(s.cta.text)}</a>
    </div>
  </div>
</section>`;
}
