import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";

interface FeaturesFields {
  headline?: string;
  subheadline?: string;
  items: { icon?: string; title: string; description: string }[];
}

export function render(section: Record<string, unknown>, _theme: Theme, profile: BusinessProfile | null): string {
  const s = section as unknown as FeaturesFields;
  const cols = s.items.length <= 3 ? s.items.length : 3;
  const gridCls = `grid-${cols}`;

  return `<section class="block-features">
  <div class="container">
    ${s.headline || s.subheadline ? `<div class="section-header">
      ${s.headline ? `<h2>${esc(interpolate(s.headline, profile))}</h2>` : ""}
      ${s.subheadline ? `<p>${esc(interpolate(s.subheadline, profile))}</p>` : ""}
    </div>` : ""}
    <div class="${gridCls}">
      ${s.items.map(item => `<div class="block-features__item">
        ${item.icon ? `<div class="block-features__icon">${esc(item.icon)}</div>` : ""}
        <h3>${esc(interpolate(item.title, profile))}</h3>
        <p>${esc(interpolate(item.description, profile))}</p>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
