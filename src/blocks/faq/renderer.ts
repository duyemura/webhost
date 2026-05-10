import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";

interface FaqFields {
  headline?: string;
  items: { question: string; answer: string }[];
}

export function render(section: Record<string, unknown>, theme: Theme, _profile: BusinessProfile | null): string {
  const s = section as unknown as FaqFields;
  const di = theme.style_hint === "dark-industrial";

  return `<section class="block-faq${di ? " block-faq--di" : ""}">
  <div class="container">
    ${s.headline ? `<div class="section-header text-center"><h2>${esc(s.headline)}</h2></div>` : ""}
    <div class="block-faq__list">
      ${s.items.map((item, i) => `<div class="block-faq__item" id="faq-${i}">
        <div class="block-faq__q" onclick="this.parentElement.classList.toggle('block-faq__item--open')">${esc(item.question)}</div>
        <div class="block-faq__a">${esc(item.answer)}</div>
      </div>`).join("\n")}
    </div>
  </div>
</section>`;
}
