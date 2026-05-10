import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { interpolate } from "../../render/interpolate.js";

interface AboutFields {
  headline?: string;
  body: string;
  image_url?: string;
  cta?: { text: string; url: string };
  image_position?: "left" | "right";
}

export function render(section: Record<string, unknown>, _theme: Theme, profile: BusinessProfile | null): string {
  const s = section as unknown as AboutFields;
  const imgLeft = s.image_position === "left";

  const imageEl = s.image_url
    ? `<div class="block-about__image"><img src="${esc(s.image_url)}" alt="" loading="lazy"></div>`
    : "";
  const textEl = `<div class="block-about__text">
    ${s.headline ? `<h2>${esc(interpolate(s.headline, profile))}</h2>` : ""}
    <p>${esc(interpolate(s.body, profile))}</p>
    ${s.cta ? `<a href="${esc(s.cta.url)}" class="btn-primary">${esc(s.cta.text)}</a>` : ""}
  </div>`;

  return `<section class="block-about">
  <div class="container">
    ${s.image_url
      ? `<div class="block-about__inner" style="${imgLeft ? "direction:rtl" : ""}">${imgLeft ? `${imageEl}${textEl}` : `${textEl}${imageEl}`}</div>`
      : textEl
    }
  </div>
</section>`;
}
