import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface GalleryFields {
  headline?: string;
  images: { url: string; alt?: string }[];
}

export function render(section: Record<string, unknown>, theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as GalleryFields;
  const di = theme.style_hint === "dark-industrial";

  return `<section class="block-gallery${di ? " block-gallery--di" : ""}">
  <div class="container">
    ${s.headline ? `<div class="section-header text-center"><h2>${esc(s.headline)}</h2></div>` : ""}
    <div class="block-gallery__grid">
      ${s.images.map(img => `<div class="block-gallery__item">
        ${img.url
          ? `<img src="${esc(img.url)}" alt="${esc(img.alt ?? "")}" loading="lazy">`
          : `<div class="block-gallery__placeholder">Photo</div>`}
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
