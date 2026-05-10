import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface VideoFields {
  headline?: string;
  subheadline?: string;
  url: string;
}

function extractEmbedUrl(url: string): string | null {
  // YouTube: youtu.be/ID or youtube.com/watch?v=ID or youtube.com/embed/ID
  let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;

  // Vimeo: vimeo.com/ID
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;

  // Reject anything else — no arbitrary URLs in iframes
  return null;
}

export function render(section: Record<string, unknown>, theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as VideoFields;
  const embedUrl = extractEmbedUrl(s.url);
  const di = theme.style_hint === "dark-industrial";

  return `<section class="block-video${di ? " block-video--di" : ""}">
  <div class="container">
    ${s.headline || s.subheadline ? `<div class="section-header text-center">
      ${s.headline ? `<h2>${esc(s.headline)}</h2>` : ""}
      ${s.subheadline ? `<p>${esc(s.subheadline)}</p>` : ""}
    </div>` : ""}
    ${embedUrl
      ? `<div class="block-video__embed-wrap"><iframe src="${esc(embedUrl)}" allowfullscreen loading="lazy" title="${esc(s.headline ?? "Video")}"></iframe></div>`
      : `<p style="text-align:center;color:var(--color-muted-fg);padding:2rem 0">Video unavailable — only YouTube and Vimeo URLs are supported.</p>`}
  </div>
</section>`;
}
