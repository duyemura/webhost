import type { BusinessProfile } from "../db/types.js";
import type { Theme } from "../blocks/types.js";
import { esc } from "./escape.js";

export function buildFooter(profile: BusinessProfile | null, _theme: Theme): string {
  const year = new Date().getFullYear();
  const name = profile?.biz_name ?? "";
  const addressParts = [profile?.address, profile?.city, profile?.state, profile?.zip].filter(Boolean);

  return `<footer class="site-footer">
  <div class="container">
    <div class="site-footer__inner">
      ${name ? `<div class="site-footer__name">${esc(name)}</div>` : ""}
      <div class="site-footer__meta">
        ${addressParts.length ? `<div>${esc(addressParts.join(", "))}</div>` : ""}
        ${profile?.phone ? `<div><a href="tel:${esc(profile.phone)}">${esc(profile.phone)}</a></div>` : ""}
        ${profile?.email ? `<div><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></div>` : ""}
        ${profile?.hours ? `<div>${esc(profile.hours)}</div>` : ""}
      </div>
      <div class="site-footer__copy">
        © ${year}${name ? ` ${esc(name)}` : ""}. All rights reserved.
      </div>
    </div>
  </div>
</footer>`;
}
