import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { diSectionHead } from "../../render/di-helpers.js";

interface TestimonialsFields {
  eyebrow?: string;
  headline?: string;
  items: { quote: string; name: string; role?: string; avatar_url?: string }[];
}

export function render(section: Record<string, unknown>, theme: Theme, _profile: BusinessProfile | null): string {
  if (theme.style_hint === "dark-industrial") return renderDI(section);
  return renderDefault(section);
}

function renderDefault(section: Record<string, unknown>): string {
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

function renderDI(section: Record<string, unknown>): string {
  const s = section as unknown as TestimonialsFields;
  const cols = Math.min(s.items.length, 3);
  const header = (s.headline || s.eyebrow) ? diSectionHead(s.eyebrow, s.headline ?? "", undefined) : "";

  return `<section class="block-testimonials block-testimonials--di">
  <div class="container">
    ${header}
    <div class="grid-${cols}">
      ${s.items.map(item => `<div class="di-quote-card">
        <p class="di-quote">"${esc(item.quote)}"</p>
        <cite class="di-cite">— ${esc(item.name)}${item.role ? ` · ${esc(item.role)}` : ""}</cite>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
