import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface TeamFields {
  headline?: string;
  members: { name: string; role?: string; bio?: string; photo_url?: string }[];
}

export function render(section: Record<string, unknown>, _theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as TeamFields;
  const cols = Math.min(s.members.length, 4);

  return `<section class="block-team">
  <div class="container">
    ${s.headline ? `<div class="section-header text-center"><h2>${esc(s.headline)}</h2></div>` : ""}
    <div class="grid-${cols}">
      ${s.members.map(m => `<div class="block-team__card">
        ${m.photo_url
          ? `<img class="block-team__photo" src="${esc(m.photo_url)}" alt="${esc(m.name)}" loading="lazy">`
          : `<div class="block-team__photo" style="display:flex;align-items:center;justify-content:center;background:var(--color-border);font-size:2rem;color:var(--color-muted-fg)">👤</div>`}
        <div class="block-team__name">${esc(m.name)}</div>
        ${m.role ? `<div class="block-team__role">${esc(m.role)}</div>` : ""}
        ${m.bio ? `<p class="block-team__bio">${esc(m.bio)}</p>` : ""}
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
