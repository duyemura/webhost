import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { sanitizeHtml } from "../../render/sanitize.js";

interface RichTextFields {
  headline?: string;
  html: string;
}

export function render(section: Record<string, unknown>, _theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as RichTextFields;

  return `<section class="block-rich-text">
  <div class="container">
    <div class="block-rich-text__inner">
      ${s.headline ? `<h2>${esc(s.headline)}</h2>` : ""}
      <div class="block-rich-text__content">${sanitizeHtml(s.html)}</div>
    </div>
  </div>
</section>`;
}
