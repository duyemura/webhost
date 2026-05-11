import type { BusinessProfile } from "../db/types.js";
import type { SiteSpec } from "../blocks/types.js";
import { esc } from "./escape.js";
import { interpolate } from "./interpolate.js";

const LEGAL_SLUG_RE = /^(privacy|terms|cancellation|cookie|sitemap|legal|disclaimer|accessibility|refund|gdpr)/i;
const LEGAL_LABEL_RE = /^(privacy|terms|cancellation|cookie|sitemap|legal|disclaimer|accessibility|refund)/i;

function isLegalPage(p: { slug: string; nav_label?: string; title?: string }): boolean {
  if (LEGAL_SLUG_RE.test(p.slug)) return true;
  const label = p.nav_label || p.title || "";
  return LEGAL_LABEL_RE.test(label.trim());
}

export function buildFooter(spec: SiteSpec, profile: BusinessProfile | null, logoUrl: string | null): string {
  const year = new Date().getFullYear();
  const name = profile?.biz_name ?? "";
  const addressParts = [profile?.address].filter(Boolean);
  const cityStateZip = [profile?.city, profile?.state, profile?.zip].filter(Boolean).join(", ");

  // Partition pages into link columns
  const allPages = spec.pages.filter(p => p.slug !== "index");
  const legalPages = allPages.filter(p => isLegalPage(p));
  const navPages = allPages.filter(p => !isLegalPage(p));

  // Group nav pages by nav_group — normalize key to lowercase for dedup,
  // but preserve the first-seen display heading
  const groupKeys = new Map<string, string>(); // lc → original heading
  const groupMap = new Map<string, typeof navPages>(); // lc → pages
  const seenSlugs = new Set<string>();
  const ungrouped: typeof navPages = [];

  for (const p of navPages) {
    if (seenSlugs.has(p.slug)) continue;
    seenSlugs.add(p.slug);

    if (p.nav_group) {
      const lc = p.nav_group.toLowerCase().trim();
      if (!groupKeys.has(lc)) groupKeys.set(lc, p.nav_group);
      if (!groupMap.has(lc)) groupMap.set(lc, []);
      groupMap.get(lc)!.push(p);
    } else {
      ungrouped.push(p);
    }
  }

  function pageLabel(p: { nav_label?: string; title?: string }): string {
    return interpolate(p.nav_label || p.title || "", profile);
  }

  function linkCol(heading: string, pages: typeof navPages): string {
    if (pages.length === 0) return "";
    const links = pages.map(p => `<li><a href="/${esc(p.slug)}">${esc(pageLabel(p))}</a></li>`).join("\n          ");
    return `<div class="site-footer__col">
      <h4 class="site-footer__col-heading">${esc(heading)}</h4>
      <ul class="site-footer__links">
          ${links}
      </ul>
    </div>`;
  }

  // Build columns: one per nav_group, then ungrouped (only if no "about" group already), then legal → "Legal"
  const cols: string[] = [];
  for (const [lc, pages] of groupMap) {
    cols.push(linkCol(groupKeys.get(lc)!, pages));
  }

  // Only render ungrouped as "About" if no group already occupies that name
  if (ungrouped.length > 0 && !groupMap.has("about")) {
    cols.push(linkCol("About", ungrouped));
  } else if (ungrouped.length > 0) {
    // Append ungrouped pages to the existing "about" column
    const aboutPages = groupMap.get("about")!;
    const existing = new Set(aboutPages.map(p => p.slug));
    for (const p of ungrouped) {
      if (!existing.has(p.slug)) aboutPages.push(p);
    }
  }

  if (legalPages.length > 0) cols.push(linkCol("Legal", legalPages));

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(name)}" class="site-footer__logo-img" />`
    : `<span class="site-footer__logo-text">${esc(name)}</span>`;

  // Brand column: logo, name, address, phone, email, hours — all in one left column
  const brandLines: string[] = [];
  if (addressParts.length > 0 || cityStateZip) {
    const addr = [addressParts.join(", "), cityStateZip].filter(Boolean).join(", ");
    brandLines.push(`<p class="site-footer__address-line">${esc(addr)}</p>`);
  }
  if (profile?.phone) brandLines.push(`<p class="site-footer__address-line"><a href="tel:${esc(profile.phone)}">${esc(profile.phone)}</a></p>`);
  if (profile?.email) brandLines.push(`<p class="site-footer__address-line"><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></p>`);
  if (profile?.hours) brandLines.push(`<p class="site-footer__hours">${esc(profile.hours.split("\n")[0] ?? "")}</p>`);

  return `<footer class="site-footer">
  <div class="container">
    <div class="site-footer__body">
      <div class="site-footer__brand">
        <a href="/" class="site-footer__logo">${logoHtml}</a>
        ${brandLines.join("\n        ")}
      </div>
      <div class="site-footer__cols">
        ${cols.join("\n        ")}
      </div>
    </div>
    <div class="site-footer__bottom">
      <p class="site-footer__copy">© ${year}${name ? ` ${esc(name)}` : ""}. All rights reserved.</p>
    </div>
  </div>
</footer>`;
}
