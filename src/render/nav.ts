import type { SiteSpec, Theme } from "../blocks/types.js";
import { esc } from "./escape.js";

// Pages that live in footer / sitemap only — never main nav
const FOOTER_SLUG_RE = /privacy|terms|cancell|cookie|sitemap|legal|disclaimer|accessibility|refund|gdpr/i;
const FOOTER_LABEL_RE = /^(privacy|terms|cancell|cookie|sitemap|legal|disclaimer|refund|blog)/i;

function isNavHidden(p: { slug: string; nav_label?: string; title?: string }): boolean {
  if (FOOTER_SLUG_RE.test(p.slug)) return true;
  const label = (p.nav_label || p.title || "").trim();
  return FOOTER_LABEL_RE.test(label);
}

export function buildNav(
  spec: SiteSpec,
  _theme: Theme,
  siteName: string,
  requestPath: string,
  logoUrl: string | null = null,
): string {
  const pages = spec.pages.filter(p => p.slug !== "index" && !isNavHidden(p));

  // Group nav pages
  const groupMap = new Map<string, typeof pages>();
  for (const p of pages) {
    if (p.nav_group) {
      if (!groupMap.has(p.nav_group)) groupMap.set(p.nav_group, []);
      groupMap.get(p.nav_group)!.push(p);
    }
  }
  const groupNames = new Set(groupMap.keys());

  const rendered: string[] = [];
  const renderedGroups = new Set<string>();

  for (const p of pages) {
    if (p.nav_group) {
      if (renderedGroups.has(p.nav_group)) continue;
      renderedGroups.add(p.nav_group);

      const children = groupMap.get(p.nav_group)!;
      // Deduplicate children by slug and by normalized label
      const seenSlugs = new Set<string>();
      const seenLabels = new Set<string>();
      const uniqueChildren = children.filter(c => {
        const label = (c.nav_label || c.title || "").toLowerCase().trim();
        if (seenSlugs.has(c.slug) || seenLabels.has(label)) return false;
        seenSlugs.add(c.slug);
        seenLabels.add(label);
        return true;
      });

      const groupActive = uniqueChildren.some(c => requestPath === `/${c.slug}` || requestPath.startsWith(`/${c.slug}/`));
      const dropdownItems = uniqueChildren.map(c => {
        const href = `/${c.slug}`;
        const active = requestPath === href || requestPath.startsWith(`/${c.slug}/`);
        return `<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(c.nav_label || c.title)}</a></li>`;
      }).join("\n          ");

      rendered.push(`<li class="site-nav__group${groupActive ? " site-nav__group--active" : ""}">
        <button class="site-nav__group-trigger" aria-expanded="false">${esc(p.nav_group)}<svg class="site-nav__chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <ul class="site-nav__dropdown">
          ${dropdownItems}
        </ul>
      </li>`);
    } else {
      const label = p.nav_label || p.title;
      if (groupNames.has(label)) continue; // label duplicates a group name — skip

      const href = `/${p.slug}`;
      const active = requestPath === href || requestPath.startsWith(`/${p.slug}/`);
      rendered.push(`<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`);
    }
  }

  // CTA: first contact-like page, or /contact fallback
  const ctaPage = spec.pages.find(p => /^contact/.test(p.slug));
  const ctaHref = ctaPage ? `/${ctaPage.slug}` : "/contact";
  const ctaLabel = ctaPage?.nav_label ?? "Get started";
  const hasCtaPage = !!ctaPage || spec.pages.some(p => p.slug === "contact");
  const ctaHtml = hasCtaPage
    ? `<li class="site-nav__cta"><a href="${esc(ctaHref)}" class="btn-primary site-nav__cta-btn">${esc(ctaLabel)}</a></li>`
    : "";

  // Clean up site name: strip SEO tails like "- Gym in Denver"
  const cleanName = siteName
    .replace(/\s*[-|]\s*(gym|fitness|crossfit|studio|club|center|sport)\b.*/i, "")
    .trim() || siteName;

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(cleanName)}" class="site-nav__logo-img">`
    : `<span class="site-nav__logo-text">${esc(cleanName)}</span>`;

  return `<nav class="site-nav" id="site-nav">
  <div class="container site-nav__inner">
    <a href="/" class="site-nav__logo" aria-label="${esc(cleanName)}">${logoHtml}</a>
    ${rendered.length > 0 ? `<ul class="site-nav__links">
      ${rendered.join("\n      ")}
      ${ctaHtml}
    </ul>` : ""}
  </div>
</nav>
<script>
(function(){
  var nav=document.getElementById('site-nav');
  function tick(){ nav.classList.toggle('site-nav--scrolled', window.scrollY > 60); }
  window.addEventListener('scroll', tick, {passive:true});
  tick();
})();
</script>`;
}
