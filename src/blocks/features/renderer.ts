import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";

interface FeaturesFields {
  headline?: string;
  subheadline?: string;
  items: { icon?: string; title: string; description: string }[];
}

const ICON_MAP: Record<string, string> = {
  star: "★", award: "★", trophy: "🏆", medal: "🥇",
  bolt: "⚡", lightning: "⚡", flash: "⚡",
  heart: "♥", love: "♥",
  check: "✓", checkmark: "✓",
  muscle: "💪", flex: "💪", strength: "💪",
  fire: "🔥", flame: "🔥",
  clock: "⏱", time: "⏱",
  users: "👥", people: "👥", group: "👥", community: "👥",
  dumbbell: "🏋", weights: "🏋",
  target: "🎯", goal: "🎯",
  leaf: "🌿", nature: "🌿",
  shield: "🛡", protect: "🛡",
  running: "🏃", run: "🏃",
  yoga: "🧘", meditation: "🧘",
  boxing: "🥊", glove: "🥊",
  bike: "🚴", cycle: "🚴",
  swim: "🏊",
  map: "📍", location: "📍",
  calendar: "📅", schedule: "📅",
  phone: "📞",
  email: "✉",
  dollar: "💲", money: "💲", price: "💲",
  chart: "📈", growth: "📈",
  lock: "🔒", security: "🔒",
  support: "🤝", handshake: "🤝",
};

function resolveIcon(icon: string): string {
  if ([...icon].length <= 2 || /[^\x00-\x7F]/.test(icon)) return icon;
  return ICON_MAP[icon.toLowerCase()] ?? icon[0]?.toUpperCase() ?? icon;
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
        ${item.icon ? `<div class="block-features__icon">${esc(resolveIcon(item.icon))}</div>` : ""}
        <h3>${esc(interpolate(item.title, profile))}</h3>
        <p>${esc(interpolate(item.description, profile))}</p>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
