import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface ReviewsFields {
  headline?: string;
  items: { text: string; author: string; rating?: number; platform?: string; date?: string }[];
}

export function render(section: Record<string, unknown>, _theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as ReviewsFields;
  const cols = Math.min(s.items.length, 3);

  return `<section class="block-reviews">
  <div class="container">
    ${s.headline ? `<div class="section-header text-center"><h2>${esc(s.headline)}</h2></div>` : ""}
    <div class="grid-${cols}">
      ${s.items.map(item => `<div class="block-reviews__card">
        ${item.rating ? `<div class="block-reviews__stars">${"★".repeat(item.rating)}${"☆".repeat(5 - item.rating)}</div>` : ""}
        <p class="block-reviews__text">${esc(item.text)}</p>
        <div class="block-reviews__meta">
          <strong>${esc(item.author)}</strong>
          ${item.date ? ` · ${esc(item.date)}` : ""}
          ${item.platform ? `<span class="block-reviews__platform">${esc(item.platform)}</span>` : ""}
        </div>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
