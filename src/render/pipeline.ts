import type { Site, BusinessProfile, Script } from "../db/types.js";
import type { SiteSpec, Theme } from "../blocks/types.js";
import { DEFAULT_THEME } from "../blocks/types.js";
import { registry } from "../blocks/index.js";
import { buildPage } from "./page.js";

export async function renderSpecPage(
  site: Pick<Site, "id" | "slug" | "custom_domain" | "spec" | "theme">,
  profile: BusinessProfile | null,
  scripts: Script[],
  requestPath: string
): Promise<string | null> {
  const spec = site.spec as SiteSpec;
  const theme = (site.theme as Theme | null) ?? DEFAULT_THEME;

  const slug = requestPath === "/" ? "index" : requestPath.replace(/^\//, "").split("/")[0];
  const page = spec.pages.find(p => p.slug === slug);
  if (!page) return null;

  const sectionsHtml = page.sections
    .map(s => registry.render(s, theme, profile))
    .join("\n");

  return buildPage({ page, spec, theme, profile, sectionsHtml, scripts, site, requestPath });
}
