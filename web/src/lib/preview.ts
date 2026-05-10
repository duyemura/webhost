import { registry } from "../../../src/blocks/index.js";
import { themeToCSS } from "../../../src/render/theme.js";
import { BASE_CSS } from "../../../src/render/base-css.js";
import { BLOCK_CSS } from "../../../src/render/block-css.js";
import type { Theme, SiteSection } from "../api";

export function buildPreviewHtml(sections: SiteSection[], theme: Theme): string {
  const css = `${themeToCSS(theme as Parameters<typeof themeToCSS>[0])}\n${BASE_CSS}\n${BLOCK_CSS}`;
  const body = sections
    .map((s) => registry.render(s as Parameters<typeof registry.render>[0], theme as Parameters<typeof registry.render>[1], null))
    .join("\n");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`;
}
