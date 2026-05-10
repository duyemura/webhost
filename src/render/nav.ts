import type { SiteSpec, Theme } from "../blocks/types.js";
import { esc } from "./escape.js";

export function buildNav(spec: SiteSpec, _theme: Theme, siteName: string, requestPath: string): string {
  const pages = spec.pages.filter(p => p.slug !== "index");

  const links = pages.map(p => {
    const href = `/${p.slug}`;
    const active = requestPath === href || requestPath.startsWith(`/${p.slug}/`);
    return `<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(p.title)}</a></li>`;
  }).join("\n");

  const hasContact = spec.pages.some(p => p.slug === "contact");

  return `<nav class="site-nav">
  <div class="container site-nav__inner">
    <a href="/" class="site-nav__logo">${esc(siteName)}</a>
    ${links ? `<ul class="site-nav__links">
      ${links}
      ${hasContact ? `<li class="site-nav__cta"><a href="/contact" class="btn-primary">Contact us</a></li>` : ""}
    </ul>` : ""}
  </div>
</nav>`;
}
