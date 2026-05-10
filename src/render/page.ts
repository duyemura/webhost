import type { SitePage, SiteSpec, Theme } from "../blocks/types.js";
import type { BusinessProfile, Script, Site } from "../db/types.js";
import { esc } from "./escape.js";
import { themeToCSS, googleFontsUrl } from "./theme.js";
import { BASE_CSS } from "./base-css.js";
import { BLOCK_CSS } from "./block-css.js";
import { buildNav } from "./nav.js";
import { buildFooter } from "./footer.js";
import { buildHeadSnippets, buildBodySnippets } from "../scripts/index.js";
import { buildSeoSnippets } from "./seo.js";

export interface PageBuildOptions {
  page: SitePage;
  spec: SiteSpec;
  theme: Theme;
  profile: BusinessProfile | null;
  sectionsHtml: string;
  scripts: Script[];
  site: Pick<Site, "id" | "slug" | "custom_domain">;
  requestPath: string;
}

export function buildPage(opts: PageBuildOptions): string {
  const { page, spec, theme, profile, sectionsHtml, scripts, site, requestPath } = opts;

  const themeCSS = themeToCSS(theme);
  const fontsUrl = googleFontsUrl(theme);
  const siteName = profile?.biz_name ?? spec.pages[0]?.title ?? "";
  const nav = buildNav(spec, theme, siteName, requestPath);
  const footer = buildFooter(profile, theme);
  const headScripts = buildHeadSnippets(scripts);
  const bodyScripts = buildBodySnippets(scripts);

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(page.title)}</title>
  ${page.meta_description ? `<meta name="description" content="${esc(page.meta_description)}">` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${esc(fontsUrl)}" rel="stylesheet">
  <style>${themeCSS}</style>
  <style>${BASE_CSS}</style>
  <style>${BLOCK_CSS}</style>
${headScripts}
</head>
<body>
  ${nav}
  <main>${sectionsHtml}</main>
  ${footer}
${bodyScripts}
</body>
</html>`;

  const seoSnippet = buildSeoSnippets(site, profile, fullHtml, requestPath);
  if (!seoSnippet) return fullHtml;
  return fullHtml.replace("</head>", `${seoSnippet}\n</head>`);
}
