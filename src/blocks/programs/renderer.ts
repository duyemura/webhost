import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";

interface ProgramsFields {
  headline?: string;
  subheadline?: string;
  items: { name: string; description: string; tag?: string; cta?: { text: string; url: string } }[];
}

export function render(section: Record<string, unknown>, _theme: Theme, profile: BusinessProfile | null): string {
  const s = section as unknown as ProgramsFields;
  const cols = s.items.length <= 2 ? s.items.length : 3;

  return `<section class="block-programs">
  <div class="container">
    ${s.headline || s.subheadline ? `<div class="section-header">
      ${s.headline ? `<h2>${esc(interpolate(s.headline, profile))}</h2>` : ""}
      ${s.subheadline ? `<p>${esc(interpolate(s.subheadline, profile))}</p>` : ""}
    </div>` : ""}
    <div class="grid-${cols}">
      ${s.items.map(item => `<div class="block-programs__card">
        <div class="block-programs__card-body">
          ${item.tag ? `<span class="block-programs__tag">${esc(item.tag)}</span>` : ""}
          <h3>${esc(interpolate(item.name, profile))}</h3>
          <p>${esc(interpolate(item.description, profile))}</p>
          ${item.cta ? `<a href="${esc(item.cta.url)}" class="btn-primary">${esc(item.cta.text)}</a>` : ""}
        </div>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
