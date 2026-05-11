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

  // Review signals first
  if (profile.gmb_rating != null && profile.gmb_review_count != null && profile.gmb_review_count > 0) {
    items.push(`★ ${Number(profile.gmb_rating).toFixed(1)} stars · ${profile.gmb_review_count.toLocaleString()} Google reviews`);
  } else if (profile.gmb_rating != null) {
    items.push(`★ ${Number(profile.gmb_rating).toFixed(1)} stars on Google`);
  } else if (profile.gmb_review_count != null && profile.gmb_review_count > 0) {
    items.push(`${profile.gmb_review_count.toLocaleString()} Google reviews`);
  }

  // Review quotes (up to 5, truncated to ~100 chars)
  if (Array.isArray(profile.gmb_reviews)) {
    for (const r of (profile.gmb_reviews as GmbReview[]).slice(0, 5)) {
      if (!r.text) continue;
      const snippet = r.text.length > 100 ? r.text.slice(0, 97) + "…" : r.text;
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
