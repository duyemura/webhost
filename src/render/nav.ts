import type { SiteSpec, Theme } from "../blocks/types.js";
import { esc } from "./escape.js";

export function buildNav(spec: SiteSpec, _theme: Theme, siteName: string, requestPath: string): string {
  const pages = spec.pages.filter(p => p.slug !== "index");

  // Separate grouped pages from top-level pages
  const grouped = new Map<string, typeof pages>();

  for (const p of pages) {
    if (p.nav_group) {
      if (!grouped.has(p.nav_group)) grouped.set(p.nav_group, []);
      grouped.get(p.nav_group)!.push(p);
    }
  }

  // Build link items: top-level pages + dropdown groups, interleaved in original order
  // Determine rendering order by first appearance of each group
  const rendered: string[] = [];
  const renderedGroups = new Set<string>();

  for (const p of pages) {
    if (p.nav_group) {
      if (renderedGroups.has(p.nav_group)) continue;
      renderedGroups.add(p.nav_group);

      const children = grouped.get(p.nav_group)!;
      const groupActive = children.some(c => requestPath === `/${c.slug}` || requestPath.startsWith(`/${c.slug}/`));
      const dropdownItems = children.map(c => {
        const href = `/${c.slug}`;
        const active = requestPath === href || requestPath.startsWith(`/${c.slug}/`);
        const label = c.nav_label || c.title;
        return `<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`;
      }).join("\n");

      rendered.push(`<li class="site-nav__group${groupActive ? " site-nav__group--active" : ""}">
        <button class="site-nav__group-trigger" aria-expanded="false">${esc(p.nav_group)}<svg class="site-nav__chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <ul class="site-nav__dropdown">
          ${dropdownItems}
        </ul>
      </li>`);
    } else {
      const href = `/${p.slug}`;
      const active = requestPath === href || requestPath.startsWith(`/${p.slug}/`);
      const label = p.nav_label || p.title;
      rendered.push(`<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`);
    }
  }

  const hasContact = spec.pages.some(p => p.slug === "contact");

  return `<nav class="site-nav">
  <div class="container site-nav__inner">
    <a href="/" class="site-nav__logo">${esc(siteName)}</a>
    ${rendered.length > 0 ? `<ul class="site-nav__links">
      ${rendered.join("\n")}
      ${hasContact ? `<li class="site-nav__cta"><a href="/contact" class="btn-primary">Contact us</a></li>` : ""}
    </ul>` : ""}
  </div>
</nav>`;
}
