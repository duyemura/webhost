import type { SiteSpec, Theme } from "../blocks/types.js";
import { esc } from "./escape.js";

// Pages that live in footer / sitemap only — never main nav
const FOOTER_SLUG_RE = /privacy|terms|cancell|cookie|sitemap|legal|disclaimer|accessibility|refund|gdpr/i;
const FOOTER_LABEL_RE = /^(privacy|terms|cancell|cookie|sitemap|legal|disclaimer|refund|blog)/i;
// Operational/account pages that pollute the nav
const OPERATIONAL_RE = /\b(pause|cancel|freeze|suspend|billing|account|login|register|sign.?up|member.?portal|waiver|liability|faq)\b/i;
// Conversion/CTA pages — these should be the CTA button, not a nav link
const CTA_SLUG_RE = /drop.?in|no.?sweat|intro|free.?trial|get.?started|join|start/i;

const MAX_NAV_ITEMS = 4; // max top-level entries before the CTA button

function isNavHidden(p: { slug: string; nav_label?: string; title?: string }): boolean {
  if (FOOTER_SLUG_RE.test(p.slug)) return true;
  const label = (p.nav_label || p.title || "").trim();
  if (FOOTER_LABEL_RE.test(label)) return true;
  if (OPERATIONAL_RE.test(label)) return true;
  return false;
}

export function buildNav(
  spec: SiteSpec,
  _theme: Theme,
  siteName: string,
  requestPath: string,
  logoUrl: string | null = null,
): string {
  // Determine CTA target first so we can exclude it from the nav links
  const ctaPage = spec.pages.find(p => CTA_SLUG_RE.test(p.slug))
    ?? spec.pages.find(p => /^contact/.test(p.slug))
    ?? spec.pages.find(p => p.slug !== "index" && !isNavHidden(p));
  const ctaSlug = ctaPage?.slug ?? null;

  const pages = spec.pages.filter(p =>
    p.slug !== "index" &&
    p.slug !== ctaSlug &&   // CTA target lives in button, not nav links
    !isNavHidden(p)
  );

  // Group nav pages — normalize group key to lowercase to deduplicate case variants
  const groupKeyMap = new Map<string, string>(); // lc → first-seen display heading
  const groupMap = new Map<string, typeof pages>(); // lc → pages
  for (const p of pages) {
    if (p.nav_group) {
      const lc = p.nav_group.toLowerCase().trim();
      if (!groupKeyMap.has(lc)) groupKeyMap.set(lc, p.nav_group);
      if (!groupMap.has(lc)) groupMap.set(lc, []);
      groupMap.get(lc)!.push(p);
    }
  }
  // groupNames used to suppress standalone links whose label duplicates a group name
  const groupNames = new Set(Array.from(groupKeyMap.values()).map(g => g.toLowerCase()));

  const rendered: string[] = [];
  const renderedGroups = new Set<string>(); // tracks lowercase keys already rendered

  for (const p of pages) {
    if (p.nav_group) {
      const lc = p.nav_group.toLowerCase().trim();
      if (renderedGroups.has(lc)) continue;
      renderedGroups.add(lc);

      const heading = groupKeyMap.get(lc)!;
      const children = groupMap.get(lc)!;

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

      // Single-child group → flatten to a plain link (no dropdown needed)
      if (uniqueChildren.length <= 1) {
        const only = uniqueChildren[0];
        if (!only) continue;
        const href = `/${only.slug}`;
        const active = requestPath === href || requestPath.startsWith(`/${only.slug}/`);
        rendered.push(`<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(only.nav_label || only.title)}</a></li>`);
        continue;
      }

      const groupActive = uniqueChildren.some(c => requestPath === `/${c.slug}` || requestPath.startsWith(`/${c.slug}/`));
      const dropdownItems = uniqueChildren.map(c => {
        const href = `/${c.slug}`;
        const active = requestPath === href || requestPath.startsWith(`/${c.slug}/`);
        return `<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(c.nav_label || c.title)}</a></li>`;
      }).join("\n          ");

      rendered.push(`<li class="site-nav__group${groupActive ? " site-nav__group--active" : ""}">
        <button class="site-nav__group-trigger" aria-expanded="false">${esc(heading)}<svg class="site-nav__chevron" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <ul class="site-nav__dropdown">
          ${dropdownItems}
        </ul>
      </li>`);
    } else {
      const label = p.nav_label || p.title;
      if (groupNames.has((label ?? "").toLowerCase())) continue; // label duplicates a group name — skip

      const href = `/${p.slug}`;
      const active = requestPath === href || requestPath.startsWith(`/${p.slug}/`);
      rendered.push(`<li><a href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`);
    }
  }

  // Cap to MAX_NAV_ITEMS so the CTA button is never pushed off-screen
  const visibleItems = rendered.slice(0, MAX_NAV_ITEMS);

  // CTA: always present, always conversion-focused
  const ctaHref = ctaPage ? `/${ctaPage.slug}` : "/contact";
  const ctaLabel = ctaPage?.nav_label ?? "Get started";
  const ctaHtml = `<li class="site-nav__cta"><a href="${esc(ctaHref)}" class="site-nav__cta-btn">${esc(ctaLabel)}</a></li>`;

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
    <ul class="site-nav__links">
      ${visibleItems.join("\n      ")}
      ${ctaHtml}
    </ul>
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
