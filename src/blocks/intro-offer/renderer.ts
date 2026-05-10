import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface IntroOfferFields {
  headline: string;
  price: string;
  period?: string;
  details?: string;
  cta: { text: string; url: string };
}

export function render(section: Record<string, unknown>, theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as IntroOfferFields;
  const di = theme.style_hint === "dark-industrial";

  return `<section class="block-intro-offer${di ? " block-intro-offer--di" : ""}">
  <div class="container">
    <div class="block-intro-offer__inner">
      <h2>${esc(s.headline)}</h2>
      <div>
        <div class="block-intro-offer__price">${esc(s.price)}</div>
        ${s.period ? `<div class="block-intro-offer__period">${esc(s.period)}</div>` : ""}
      </div>
      ${s.details ? `<p class="block-intro-offer__details">${esc(s.details)}</p>` : ""}
      <a href="${esc(s.cta.url)}" class="btn-secondary">${esc(s.cta.text)}</a>
    </div>
  </div>
</section>`;
}
