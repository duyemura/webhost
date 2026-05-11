import type { FastifyPluginAsync } from "fastify";
import { config } from "../config.js";

// Google Places API (New) — https://developers.google.com/maps/documentation/places/web-service/text-search
const PLACES_BASE = "https://places.googleapis.com/v1";

// Types we consider "fitness" businesses — ranked first but not hard-filtered,
// but we don't hard-filter so the user can still pick a martial arts school, dance studio, etc.
const FITNESS_TYPES = new Set([
  "gym", "fitness_center", "yoga_studio", "pilates_studio", "sports_club",
  "health_club", "boxing_gym", "dance_studio", "martial_arts_school",
  "physical_fitness_program",
]);

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  types: string[];
  rating: number | null;
  reviewCount: number | null;
  isFitness: boolean;
}

export interface PlaceDetail extends PlaceSearchResult {
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  hours: string | null;
}

function extractAddressComponent(components: unknown[], type: string): string | null {
  if (!Array.isArray(components)) return null;
  const comp = components.find((c: unknown) => {
    return Array.isArray((c as Record<string, unknown>).types) &&
      ((c as Record<string, unknown>).types as string[]).includes(type);
  }) as Record<string, unknown> | undefined;
  return comp ? String(comp.shortText ?? comp.longText ?? "") : null;
}

export const placesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  // GET /api/places/search?q=Speakeasy+of+Strength+NYC
  app.get("/api/places/search", async (req, reply) => {
    const { q } = req.query as { q?: string };
    if (!q?.trim()) return reply.badRequest("Missing query");

    const apiKey = config.googleMapsApiKey;
    if (!apiKey) return reply.internalServerError("Google Places API key not configured");

    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.nationalPhoneNumber",
          "places.websiteUri",
          "places.types",
          "places.rating",
          "places.userRatingCount",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: q,
        languageCode: "en",
        maxResultCount: 10,
      }),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      app.log.error({ err }, "Google Places search failed");
      return reply.internalServerError("Places search failed");
    }

    const data = await res.json() as { places?: unknown[] };
    const places = (data.places ?? []) as Record<string, unknown>[];

    const results: PlaceSearchResult[] = places.map(p => {
      const types = Array.isArray(p.types) ? (p.types as string[]) : [];
      return {
        id: String(p.id ?? ""),
        name: String((p.displayName as Record<string, unknown>)?.text ?? ""),
        address: String(p.formattedAddress ?? ""),
        phone: p.nationalPhoneNumber ? String(p.nationalPhoneNumber) : null,
        website: p.websiteUri ? String(p.websiteUri) : null,
        types,
        rating: p.rating != null ? Number(p.rating) : null,
        reviewCount: p.userRatingCount != null ? Number(p.userRatingCount) : null,
        isFitness: types.some(t => FITNESS_TYPES.has(t)),
      };
    });

    // Fitness businesses first, then by rating
    results.sort((a, b) => {
      if (a.isFitness !== b.isFitness) return a.isFitness ? -1 : 1;
      return (b.rating ?? 0) - (a.rating ?? 0);
    });

    return results.slice(0, 6);
  });

  // GET /api/places/:id — full details including hours + address components
  app.get("/api/places/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const apiKey = config.googleMapsApiKey;
    if (!apiKey) return reply.internalServerError("Google Places API key not configured");

    const fieldMask = [
      "id", "displayName", "formattedAddress", "nationalPhoneNumber",
      "websiteUri", "types", "rating", "userRatingCount", "addressComponents",
      "regularOpeningHours.weekdayDescriptions",
    ].join(",");

    const res = await fetch(`${PLACES_BASE}/places/${encodeURIComponent(id)}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
    });

    if (!res.ok) {
      return reply.internalServerError("Could not fetch place details");
    }

    const p = await res.json() as Record<string, unknown>;
    const types = Array.isArray(p.types) ? (p.types as string[]) : [];
    const components = (p.addressComponents as unknown[]) ?? [];

    const weekdayDescriptions = (
      (p.regularOpeningHours as Record<string, unknown>)?.weekdayDescriptions
    );
    const hours = Array.isArray(weekdayDescriptions)
      ? (weekdayDescriptions as string[]).join("\n")
      : null;

    const detail: PlaceDetail = {
      id: String(p.id ?? id),
      name: String((p.displayName as Record<string, unknown>)?.text ?? ""),
      address: String(p.formattedAddress ?? ""),
      phone: p.nationalPhoneNumber ? String(p.nationalPhoneNumber) : null,
      website: p.websiteUri ? String(p.websiteUri) : null,
      types,
      rating: p.rating != null ? Number(p.rating) : null,
      reviewCount: p.userRatingCount != null ? Number(p.userRatingCount) : null,
      isFitness: types.some(t => FITNESS_TYPES.has(t)),
      city: extractAddressComponent(components, "locality"),
      state: extractAddressComponent(components, "administrative_area_level_1"),
      zip: extractAddressComponent(components, "postal_code"),
      country: extractAddressComponent(components, "country"),
      hours,
    };

    return detail;
  });
};
