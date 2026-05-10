import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BusinessProfile } from "../../db/types.js";

// Mock config before importing the renderer so googleMapsApiKey can be controlled per test
vi.mock("../../config.js", () => ({
  config: {
    googleMapsApiKey: "",
    baseDomain: "localhost",
  },
}));

// Import after mock is set up
const { render } = await import("../../blocks/map-location/renderer.js");

const profile: BusinessProfile = {
  id: "p1",
  site_id: "s1",
  biz_name: "Iron Works CrossFit",
  city: "Las Vegas",
  state: "NV",
  phone: "(702) 555-1234",
  email: "info@ironworks.com",
  address: "123 Main St",
  hours: "Mon–Fri 6am–8pm",
  description: "Premier CrossFit gym",
  zip: "89101",
  country: "US",
  website_url: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function section(fields: Record<string, unknown> = {}) {
  return { id: "m1", type: "map-location", ...fields };
}

describe("map-location renderer", () => {
  it("shows address in info panel", () => {
    const html = render(section(), undefined, profile);
    expect(html).toContain("123 Main St");
    expect(html).toContain("Las Vegas");
  });

  it("shows hours when show_hours is true (default)", () => {
    const html = render(section(), undefined, profile);
    expect(html).toContain("Mon–Fri 6am–8pm");
  });

  it("hides hours when show_hours is false", () => {
    const html = render(section({ show_hours: false }), undefined, profile);
    expect(html).not.toContain("Mon–Fri 6am–8pm");
  });

  it("shows phone when show_phone is true (default)", () => {
    const html = render(section(), undefined, profile);
    expect(html).toContain("(702) 555-1234");
  });

  it("hides phone when show_phone is false", () => {
    const html = render(section({ show_phone: false }), undefined, profile);
    expect(html).not.toContain("(702) 555-1234");
  });

  it("hides email by default (show_email defaults to false)", () => {
    const html = render(section(), undefined, profile);
    expect(html).not.toContain("info@ironworks.com");
  });

  it("shows email when show_email is true", () => {
    const html = render(section({ show_email: true }), undefined, profile);
    expect(html).toContain("info@ironworks.com");
    expect(html).toContain('href="mailto:');
  });

  it("renders map placeholder text when no API key", () => {
    const html = render(section(), undefined, profile);
    expect(html).toContain("Map requires a Google Maps API key");
    expect(html).not.toContain("<iframe");
  });

  it("renders gracefully when profile is null", () => {
    const html = render(section(), undefined, null);
    expect(html).toContain("block-map-location");
    expect(html).not.toContain("undefined");
  });

  it("uses custom headline when provided", () => {
    const html = render(section({ headline: "Visit Our Gym" }), undefined, profile);
    expect(html).toContain("Visit Our Gym");
  });

  it("hides map section when show_map is false", () => {
    const html = render(section({ show_map: false }), undefined, profile);
    expect(html).not.toContain("block-map-location__map");
  });

  it("defaults to 'Find {biz_name}' headline", () => {
    const html = render(section(), undefined, profile);
    expect(html).toContain("Find Iron Works CrossFit");
  });

  it("defaults to 'Find Us' headline when no profile", () => {
    const html = render(section(), undefined, null);
    expect(html).toContain("Find Us");
  });
});
