import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface StatsFields {
  headline?: string;
  items: { value: string; label: string }[];
}

export function render(section: Record<string, unknown>, theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as StatsFields;
  const cols = Math.min(s.items.length, 4);
  const di = theme.style_hint === "dark-industrial";

  return `<section class="block-stats${di ? " block-stats--di" : ""}">
  <div class="container">
    ${s.headline ? `<div class="section-header text-center"><h2>${esc(s.headline)}</h2></div>` : ""}
    <div class="grid-${cols}">
      ${s.items.map(item => `<div class="block-stats__item">
        <div class="block-stats__value">${esc(item.value)}</div>
        <div class="block-stats__label">${esc(item.label)}</div>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
