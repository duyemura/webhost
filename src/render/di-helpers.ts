import { esc } from "./escape.js";

export function diEyebrow(text: string): string {
  return `<span class="di-eyebrow">${esc(text)}</span>`;
}

export function diHeadlineLines(text: string, accentWords?: string[]): string {
  const lines = text.split(/\n/);
  return lines.map(line => {
    if (!accentWords?.length) return esc(line);
    return line.split(/(\s+)/).map(chunk => {
      const trimmed = chunk.trim();
      if (!trimmed) return chunk;
      const clean = trimmed.replace(/[.,!?;:]+$/, "");
      const match = accentWords.some(a =>
        a.toUpperCase() === trimmed.toUpperCase() ||
        a.toUpperCase() === clean.toUpperCase()
      );
      return match ? `<span class="di-accent">${esc(trimmed)}</span>` : esc(trimmed);
    }).join("");
  }).join("<br>");
}

export function diSectionHead(
  eyebrow: string | undefined,
  headline: string,
  body: string | undefined,
  accentWords?: string[],
  tag: "h1" | "h2" = "h2"
): string {
  const headlineHtml = `<${tag}>${diHeadlineLines(headline, accentWords)}</${tag}>`;
  const eyebrowHtml = eyebrow ? `${diEyebrow(eyebrow)}\n    ` : "";
  if (body) {
    return `<div class="di-section-head">
    <div>${eyebrowHtml}${headlineHtml}</div>
    <div><p class="di-body">${esc(body)}</p></div>
  </div>`;
  }
  return `<div class="di-section-head di-section-head--solo">
    ${eyebrowHtml}${headlineHtml}
  </div>`;
}
