import type { Theme, SiteCta } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface PricingItem {
  name: string;
  description?: string;
  price: string;
  period?: string;
  features: string[];
  cta: { text: string; url: string };
  featured?: boolean;
  badge?: string;
}

interface PricingFields {
  headline?: string;
  subheadline?: string;
  items: PricingItem[];
}

export function render(section: Record<string, unknown>, theme: Theme, _profile: unknown, siteCta?: SiteCta): string {
  const s = section as unknown as PricingFields;
  const di = theme.style_hint === "dark-industrial";

  return `<section class="block-pricing${di ? " block-pricing--di" : ""}">
  <div class="container">
    ${s.headline || s.subheadline ? `<div class="section-header text-center">
      ${s.headline ? `<h2>${esc(s.headline)}</h2>` : ""}
      ${s.subheadline ? `<p>${esc(s.subheadline)}</p>` : ""}
    </div>` : ""}
    <div class="grid-${Math.min(s.items.length, 3)}">
      ${s.items.map(item => `<div class="block-pricing__card${item.featured ? " block-pricing__card--featured" : ""}">
        ${item.badge ? `<span class="block-pricing__badge">${esc(item.badge)}</span>` : ""}
        <div class="block-pricing__name">${esc(item.name)}</div>
        ${item.description ? `<div class="block-pricing__desc">${esc(item.description)}</div>` : ""}
        <div class="block-pricing__price">${esc(item.price)}</div>
        ${item.period ? `<div class="block-pricing__period">${esc(item.period)}</div>` : ""}
        <ul class="block-pricing__features">
          ${item.features.map(f => `<li>${esc(f)}</li>`).join("\n")}
        </ul>
        <a href="${esc(siteCta?.url ?? item.cta.url)}" class="btn-primary">${esc(item.cta.text)}</a>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
