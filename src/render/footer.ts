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

  // Address column — only render if we have something to show
  const hasAddress = addressParts.length > 0 || cityStateZip || profile?.phone;
  if (hasAddress) {
    const lines: string[] = [];
    if (addressParts.length > 0) lines.push(`<p>${esc(addressParts.join(", "))}</p>`);
    if (cityStateZip) lines.push(`<p>${esc(cityStateZip)}</p>`);
    if (profile?.phone) lines.push(`<p><a href="tel:${esc(profile.phone)}">${esc(profile.phone)}</a></p>`);
    if (profile?.email) lines.push(`<p><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></p>`);
    cols.push(`<div class="site-footer__col">
      <h4 class="site-footer__col-heading">Contact</h4>
      <div class="site-footer__address">${lines.join("\n      ")}</div>
    </div>`);
  }

  const logoHtml = logoUrl
    ? `<img src="${esc(logoUrl)}" alt="${esc(name)}" class="site-footer__logo-img" />`
    : `<span class="site-footer__logo-text">${esc(name)}</span>`;

  return `<footer class="site-footer">
  <div class="container">
    <div class="site-footer__body">
      <div class="site-footer__brand">
        <a href="/" class="site-footer__logo">${logoHtml}</a>
        ${profile?.hours ? `<p class="site-footer__hours">${esc(profile.hours.split("\n")[0] ?? "")}</p>` : ""}
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
