import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";
import { diSectionHead } from "../../render/di-helpers.js";

interface ProgramsFields {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  items: { name: string; description: string; image_url?: string; tag?: string; cta?: { text: string; url: string } }[];
}

export function render(section: Record<string, unknown>, theme: Theme, profile: BusinessProfile | null): string {
  if (theme.style_hint === "dark-industrial") return renderDI(section, profile);
  return renderDefault(section, profile);
}

function renderDefault(section: Record<string, unknown>, profile: BusinessProfile | null): string {
  const s = section as unknown as ProgramsFields;
  const hasImages = s.items.some(item => item.image_url);

  if (hasImages) {
    // Media layout: image left, content right, stacked rows
    return `<section class="block-programs block-programs--media">
  <div class="container">
    ${s.headline || s.subheadline ? `<div class="section-header">
      ${s.eyebrow ? `<p class="eyebrow">${esc(interpolate(s.eyebrow, profile))}</p>` : ""}
      ${s.headline ? `<h2>${esc(interpolate(s.headline, profile))}</h2>` : ""}
      ${s.subheadline ? `<p>${esc(interpolate(s.subheadline, profile))}</p>` : ""}
    </div>` : ""}
    <div class="block-programs__media-list">
      ${s.items.map(item => `<div class="block-programs__media-item">
        ${item.image_url ? `<div class="block-programs__media-img">
          <img src="${esc(item.image_url)}" alt="${esc(item.name)}" loading="lazy">
        </div>` : `<div class="block-programs__media-img block-programs__media-img--empty"></div>`}
        <div class="block-programs__media-body">
          ${item.tag ? `<span class="block-programs__tag">${esc(item.tag)}</span>` : ""}
          <h3>${esc(interpolate(item.name, profile))}</h3>
          <p>${esc(interpolate(item.description, profile))}</p>
          ${item.cta ? `<a href="${esc(item.cta.url)}" class="btn-link">${esc(item.cta.text)}</a>` : ""}
        </div>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
  }

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

function renderDI(section: Record<string, unknown>, profile: BusinessProfile | null): string {
  const s = section as unknown as ProgramsFields;
  const cols = s.items.length <= 2 ? s.items.length : 3;
  const header = (s.headline || s.eyebrow) ? diSectionHead(
    s.eyebrow ? interpolate(s.eyebrow, profile) : undefined,
    s.headline ? interpolate(s.headline, profile) : "",
    s.subheadline ? interpolate(s.subheadline, profile) : undefined,
  ) : "";

  return `<section class="block-programs block-programs--di">
  <div class="container">
    ${header}
    <div class="grid-${cols}">
      ${s.items.map(item => `<div class="di-card">
        ${item.tag ? `<div class="di-program-tag">${esc(item.tag)}</div>` : ""}
        <h3>${esc(interpolate(item.name, profile))}</h3>
        <p>${esc(interpolate(item.description, profile))}</p>
        ${item.cta ? `<a href="${esc(item.cta.url)}" class="di-program-link">${esc(item.cta.text)}</a>` : ""}
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
