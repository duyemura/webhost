import type { Theme } from "../types.js";
import type { BusinessProfile } from "../../db/types.js";
import { esc } from "../../render/escape.js";
import { config } from "../../config.js";

interface MapLocationFields {
  headline?: string;
  show_map?: boolean;
  show_hours?: boolean;
  show_phone?: boolean;
  show_email?: boolean;
}

function buildAddress(profile: BusinessProfile): string {
  const parts = [
    profile.address,
    profile.city,
    profile.state,
    profile.zip,
  ].filter(Boolean);
  return parts.join(", ");
}

export function render(section: Record<string, unknown>, _theme: Theme, profile: BusinessProfile | null): string {
  const s = section as unknown as MapLocationFields;
  const showMap = s.show_map !== false;
  const showHours = s.show_hours !== false;
  const showPhone = s.show_phone !== false;
  const showEmail = s.show_email === true;

  const address = profile ? buildAddress(profile) : "";
  const mapsKey = config.googleMapsApiKey;
  const mapEmbedUrl = address && mapsKey
    ? `https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(address)}&key=${mapsKey}`
    : "";

  const mapEl = showMap
    ? mapEmbedUrl
      ? `<div class="block-map-location__map"><iframe src="${esc(mapEmbedUrl)}" allowfullscreen loading="lazy" title="Location map"></iframe></div>`
      : `<div class="block-map-location__map" style="display:flex;align-items:center;justify-content:center;color:var(--color-muted-fg)">${address ? "Map requires a Google Maps API key" : "No address set"}</div>`
    : "";

  return `<section class="block-map-location">
  <div class="container">
    <div class="block-map-location__inner">
      <div class="block-map-location__info">
        <h2>${esc(s.headline ?? (profile?.biz_name ? `Find ${profile.biz_name}` : "Find Us"))}</h2>
        ${address ? `<div class="block-map-location__detail"><strong>Address</strong>${esc(address)}</div>` : ""}
        ${showHours && profile?.hours ? `<div class="block-map-location__detail"><strong>Hours</strong>${esc(profile.hours)}</div>` : ""}
        ${showPhone && profile?.phone ? `<div class="block-map-location__detail"><strong>Phone</strong><a href="tel:${esc(profile.phone)}">${esc(profile.phone)}</a></div>` : ""}
        ${showEmail && profile?.email ? `<div class="block-map-location__detail"><strong>Email</strong><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a></div>` : ""}
      </div>
      ${mapEl}
    </div>
  </div>
</section>`;
}
