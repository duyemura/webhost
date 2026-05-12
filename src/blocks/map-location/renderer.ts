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
  return [profile.address, profile.city, profile.state, profile.zip]
    .filter(Boolean)
    .join(", ");
}

// Format raw GMB hours into a clean table.
// Input lines: "Monday: 5:00 AM – 12:00 PM" or "Monday: Open 24 hours"
function parseHours(raw: string): { day: string; hours: string }[] {
  const DAY_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(.*)$/i;
  return raw
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const m = DAY_RE.exec(line);
      if (!m) return { day: line, hours: "" };
      return { day: m[1], hours: m[2].trim() };
    });
}

function hoursHtml(raw: string): string {
  const rows = parseHours(raw);
  if (!rows.length) return `<p class="block-map-location__hours-raw">${esc(raw)}</p>`;
  return `<table class="block-map-location__hours-table">
    ${rows.map(r => `<tr>
      <td class="block-map-location__hours-day">${esc(r.day)}</td>
      <td class="block-map-location__hours-time">${esc(r.hours || "Closed")}</td>
    </tr>`).join("\n    ")}
  </table>`;
}

export function render(section: Record<string, unknown>, theme: Theme, profile: BusinessProfile | null): string {
  const s = section as unknown as MapLocationFields;
  const di = theme.style_hint === "dark-industrial";
  const showMap = s.show_map !== false;
  const showHours = s.show_hours !== false;
  const showPhone = s.show_phone !== false;
  const showEmail = s.show_email === true;

  const address = profile ? buildAddress(profile) : "";
  const mapsKey = config.googleMapsApiKey;

  // Prefer place_id embed — shows the correct GMB business card and pin
  let mapEmbedUrl = "";
  if (mapsKey) {
    if (profile?.gmb_place_id) {
      mapEmbedUrl = `https://www.google.com/maps/embed/v1/place?q=place_id:${encodeURIComponent(profile.gmb_place_id)}&key=${mapsKey}`;
    } else if (address) {
      mapEmbedUrl = `https://www.google.com/maps/embed/v1/place?q=${encodeURIComponent(address)}&key=${mapsKey}`;
    }
  }

  const mapEl = showMap
    ? mapEmbedUrl
      ? `<div class="block-map-location__map"><iframe src="${esc(mapEmbedUrl)}" allowfullscreen loading="lazy" title="Location map"></iframe></div>`
      : `<div class="block-map-location__map block-map-location__map--empty">${address ? "Map requires a Google Maps API key" : "No address set"}</div>`
    : "";

  const headline = s.headline
    ?? (profile?.city ? profile.city : (profile?.biz_name ? `Find ${profile.biz_name}` : "Find us"));

  return `<section class="block-map-location${di ? " block-map-location--di" : ""}">
  <div class="container">
    <div class="block-map-location__inner">
      <div class="block-map-location__info">
        <h2>${esc(headline)}</h2>
        ${address ? `<div class="block-map-location__detail">
          <span class="block-map-location__icon" aria-hidden="true">📍</span>${esc(address)}
        </div>` : ""}
        ${showEmail && profile?.email ? `<div class="block-map-location__detail">
          <span class="block-map-location__icon" aria-hidden="true">✉️</span><a href="mailto:${esc(profile.email)}">${esc(profile.email)}</a>
        </div>` : ""}
        ${showPhone && profile?.phone ? `<div class="block-map-location__detail">
          <span class="block-map-location__icon" aria-hidden="true">📞</span><a href="tel:${esc(profile.phone)}">${esc(profile.phone)}</a>
        </div>` : ""}
        ${showHours && profile?.hours ? `<div class="block-map-location__hours">
          <p class="block-map-location__hours-label">Working hours:</p>
          ${hoursHtml(profile.hours)}
        </div>` : ""}
      </div>
      ${mapEl}
    </div>
  </div>
</section>`;
}
