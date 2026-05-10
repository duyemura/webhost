import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface TestimonialsFields {
  headline?: string;
  items: { quote: string; name: string; role?: string; avatar_url?: string }[];
}

export function render(section: Record<string, unknown>, _theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as TestimonialsFields;
  const cols = Math.min(s.items.length, 3);

  return `<section class="block-testimonials">
  <div class="container">
    ${s.headline ? `<div class="section-header text-center"><h2>${esc(s.headline)}</h2></div>` : ""}
    <div class="grid-${cols}">
      ${s.items.map(item => `<div class="block-testimonials__card">
        <p class="block-testimonials__quote">"${esc(item.quote)}"</p>
        <div class="block-testimonials__author">
          ${item.avatar_url ? `<img class="block-testimonials__avatar" src="${esc(item.avatar_url)}" alt="" loading="lazy">` : ""}
          <div>
            <div class="block-testimonials__name">${esc(item.name)}</div>
            ${item.role ? `<div class="block-testimonials__role">${esc(item.role)}</div>` : ""}
          </div>
        </div>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
