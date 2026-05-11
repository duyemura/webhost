import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface MarqueeFields {
  items: string[];
  speed?: number;
}

export function render(section: Record<string, unknown>, _theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as MarqueeFields;
  // Scale with item count so speed stays consistent regardless of how many items there are
  const duration = s.speed ?? Math.max(40, s.items.length * 5);
  // Duplicate items so the seamless loop works
  const doubled = [...s.items, ...s.items];

  return `<div class="block-marquee" style="--marquee-duration:${duration}s">
  <div class="block-marquee__track">
    ${doubled.map(item => `<span class="block-marquee__item">${esc(item)}</span>`).join("")}
  </div>
</div>`;
}
