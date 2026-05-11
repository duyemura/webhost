import type { Site, BusinessProfile, Script } from "../db/types.js";
import type { SiteSpec, Theme } from "../blocks/types.js";
import { DEFAULT_THEME } from "../blocks/types.js";
import type { BrandKit } from "../lib/brand.js";
import { registry } from "../blocks/index.js";
import { buildPage } from "./page.js";
import { buildSocialProofBar } from "./social-proof.js";
import { esc } from "./escape.js";
import { interpolate } from "./interpolate.js";

function applyBrandKit(theme: Theme, brandKit: BrandKit): Theme {
  return {
    ...theme,
    colors: {
      ...theme.colors,
      primary: brandKit.primary,
      primary_foreground: brandKit.primary_foreground,
      secondary: brandKit.secondary,
      background: brandKit.background,
      foreground: brandKit.foreground,
      accent: brandKit.accent,
    },
    typography: {
      ...theme.typography,
      heading_font: brandKit.heading_font,
      body_font: brandKit.body_font,
    },
  };
}

export async function renderSpecPage(
  site: Pick<Site, "id" | "slug" | "custom_domain" | "spec" | "theme" | "brand_kit">,
  profile: BusinessProfile | null,
  scripts: Script[],
  requestPath: string,
  debug = false,
): Promise<string | null> {
  const spec = site.spec as SiteSpec;
  const baseTheme = (site.theme as Theme | null) ?? DEFAULT_THEME;
  const brandKit = site.brand_kit as BrandKit | null;
  const theme = brandKit ? applyBrandKit(baseTheme, brandKit) : baseTheme;

  const slug = requestPath === "/" ? "index" : requestPath.replace(/^\//, "").split("/")[0];
  const page = spec.pages.find(p => p.slug === slug);
  if (!page) return null;

  const socialProofBar = buildSocialProofBar(profile);
  let socialProofInjected = false;

  const sectionsHtml = interpolate(page.sections
    .map(s => {
      const html = registry.render(s, theme, profile);
      const bg = (s as Record<string, unknown>).bg as string | undefined;
      let wrapped = !bg || bg === "default" ? html : `<div class="section-bg--${bg}">${html}</div>`;
      if (debug) {
        wrapped = `<div style="position:relative">${wrapped}<span style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,.65);color:#fff;font:11px/1.4 monospace;padding:2px 7px;border-radius:4px;pointer-events:none;z-index:9999;letter-spacing:.04em;opacity:.85">${esc(s.type)}</span></div>`;
      }
      if (s.type === "hero" && socialProofBar && !socialProofInjected) {
        socialProofInjected = true;
        return `${wrapped}\n${socialProofBar}`;
      }
      return wrapped;
    })
    .join("\n"), profile);

  const faviconUrl = brandKit?.favicon_url ?? null;
  return buildPage({ page, spec, theme, profile, sectionsHtml, scripts, site, requestPath, faviconUrl });
}
