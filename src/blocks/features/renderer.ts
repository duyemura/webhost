import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";
import { diSectionHead } from "../../render/di-helpers.js";

interface FeaturesFields {
  eyebrow?: string;
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

export function render(section: Record<string, unknown>, theme: Theme, profile: BusinessProfile | null): string {
  if (theme.style_hint === "dark-industrial") return renderDI(section, profile);
  return renderDefault(section, profile);
}

function renderDefault(section: Record<string, unknown>, profile: BusinessProfile | null): string {
  const s = section as unknown as FeaturesFields;
  const cols = s.items.length <= 3 ? s.items.length : 3;

  return `<section class="block-features">
  <div class="container">
    ${s.headline || s.subheadline ? `<div class="section-header">
      ${s.headline ? `<h2>${esc(interpolate(s.headline, profile))}</h2>` : ""}
      ${s.subheadline ? `<p>${esc(interpolate(s.subheadline, profile))}</p>` : ""}
    </div>` : ""}
    <div class="grid-${cols}">
      ${s.items.map(item => `<div class="block-features__item">
        ${item.icon ? `<div class="block-features__icon">${esc(resolveIcon(item.icon))}</div>` : ""}
        <h3>${esc(interpolate(item.title, profile))}</h3>
        <p>${esc(interpolate(item.description, profile))}</p>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}

function renderDI(section: Record<string, unknown>, profile: BusinessProfile | null): string {
  const s = section as unknown as FeaturesFields;
  const cols = s.items.length <= 3 ? s.items.length : s.items.length === 4 ? 4 : 3;
  const header = (s.headline || s.eyebrow) ? diSectionHead(
    s.eyebrow ? interpolate(s.eyebrow, profile) : undefined,
    s.headline ? interpolate(s.headline, profile) : "",
    s.subheadline ? interpolate(s.subheadline, profile) : undefined,
  ) : "";

  return `<section class="block-features block-features--di">
  <div class="container">
    ${header}
    <div class="grid-${cols}">
      ${s.items.map((item, i) => `<div class="di-card">
        <div class="di-num-badge">/ ${String(i + 1).padStart(2, "0")}</div>
        <h3>${esc(interpolate(item.title, profile))}</h3>
        <p>${esc(interpolate(item.description, profile))}</p>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
