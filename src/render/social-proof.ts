import type { BusinessProfile } from "../db/types.js";
import { esc } from "./escape.js";

interface GmbReview {
  author: string;
  rating: number;
  text: string;
}

export function buildSocialProofBar(profile: BusinessProfile | null): string {
  if (!profile) return "";

  const items: string[] = [];

  if (profile.gmb_rating != null) {
    items.push(`★ ${Number(profile.gmb_rating).toFixed(1)} Google rating`);
  }
  if (profile.gmb_review_count != null && profile.gmb_review_count > 0) {
    items.push(`${profile.gmb_review_count.toLocaleString()} reviews`);
  }
  if (profile.biz_name) {
    items.push(profile.biz_name);
  }
  if (profile.city && profile.state) {
    items.push(`${profile.city}, ${profile.state}`);
  }
  if (profile.phone) {
    items.push(profile.phone);
  }

  // Inject up to 3 review snippets (truncated to ~80 chars)
  if (Array.isArray(profile.gmb_reviews)) {
    for (const r of (profile.gmb_reviews as GmbReview[]).slice(0, 3)) {
      if (!r.text) continue;
      const snippet = r.text.length > 80 ? r.text.slice(0, 77) + "…" : r.text;
      const stars = "★".repeat(Math.min(5, Math.round(r.rating)));
      items.push(`${stars} "${snippet}"`);
    }
  }

  if (items.length < 2) return "";

  // Duplicate for seamless infinite scroll
  const doubled = [...items, ...items];
  const duration = Math.max(20, items.length * 5);

  return `<div class="social-proof-bar" aria-hidden="true">
  <div class="social-proof-bar__track" style="--sp-duration:${duration}s">
    ${doubled.map(item => `<span class="social-proof-bar__item">${esc(item)}</span>`).join("")}
  </div>
</div>`;
}
