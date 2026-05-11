import type { SiteSpec, Theme } from "../blocks/types.js";
import { esc } from "./escape.js";

// Pages that belong in the footer, not the main nav
const FOOTER_SLUG_RE = /^(privacy|terms|cancellation|cookie|sitemap|legal|disclaimer|accessibility|refund|gdpr)/i;
const FOOTER_LABEL_RE = /^(privacy|terms|cancellation|cookie|sitemap|legal|disclaimer|accessibility|refund)/i;

function isFooterPage(p: { slug: string; nav_label?: string; title?: string }): boolean {
  if (FOOTER_SLUG_RE.test(p.slug)) return true;
  const label = p.nav_label || p.title || "";
  return FOOTER_LABEL_RE.test(label.trim());
}

export function buildNav(spec: SiteSpec, _theme: Theme, siteName: string, requestPath: string): string {
  // Exclude home and footer-only pages from nav
  const pages = spec.pages.filter(p => p.slug !== "index" && !isFooterPage(p));

  // Collect nav groups
  const grouped = new Map<string, typeof pages>();
  for (const p of pages) {
    if (p.nav_group) {
      if (!grouped.has(p.nav_group)) grouped.set(p.nav_group, []);
      grouped.get(p.nav_group)!.push(p);
    }
  }

  // Build nav items in original page order, deduplicating group names.
  // If a standalone page's nav_label exactly matches a group name, hide it —
  // the dropdown already represents that group.
  const groupNames = new Set(grouped.keys());
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
      const label = p.nav_label || p.title;
      // Skip standalone page if its label duplicates a nav_group name
      if (groupNames.has(label)) continue;

      const href = `/${p.slug}`;
      const active = requestPath === href || requestPath.startsWith(`/${p.slug}/`);
      rendered.push(`<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`);
    }
  }

  const hasContact = spec.pages.some(p => p.slug === "contact");

  // Prefer a clean site name: strip common SEO suffixes like "| City Name" or "- Gym in City"
  const cleanName = siteName.replace(/\s*[-|]\s*(gym|fitness|crossfit|studio|club|center|centre|sport)\b.*/i, "").trim() || siteName;

  return `<nav class="site-nav">
  <div class="container site-nav__inner">
    <a href="/" class="site-nav__logo">${esc(cleanName)}</a>
    ${rendered.length > 0 ? `<ul class="site-nav__links">
      ${rendered.join("\n")}
      ${hasContact ? `<li class="site-nav__cta"><a href="/contact" class="btn-primary">Contact us</a></li>` : ""}
    </ul>` : ""}
  </div>
</nav>`;
}
