import { describe, it, expect } from "vitest";
import { interpolate } from "../../render/interpolate.js";
import type { BusinessProfile } from "../../db/types.js";

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

describe("interpolate()", () => {
  it("replaces {{business.name}}", () => {
    expect(interpolate("Welcome to {{business.name}}!", profile)).toBe(
      "Welcome to Iron Works CrossFit!"
    );
  });

  it("replaces all supported tokens", () => {
    const template =
      "{{business.name}} {{business.city}} {{business.state}} {{business.phone}} {{business.email}} {{business.address}} {{business.hours}} {{business.description}}";
    expect(interpolate(template, profile)).toBe(
      "Iron Works CrossFit Las Vegas NV (702) 555-1234 info@ironworks.com 123 Main St Mon–Fri 6am–8pm Premier CrossFit gym"
    );
  });

  it("replaces multiple occurrences of the same token", () => {
    expect(interpolate("{{business.name}} — {{business.name}}", profile)).toBe(
      "Iron Works CrossFit — Iron Works CrossFit"
    );
  });

  it("returns original text when profile is null", () => {
    const text = "Hello {{business.name}}";
    expect(interpolate(text, null)).toBe(text);
  });

  it("replaces with empty string when profile field is null", () => {
    const sparse: BusinessProfile = { ...profile, city: null as string | null, phone: null as string | null };
    expect(interpolate("{{business.city}} {{business.phone}}", sparse)).toBe(
      " "
    );
  });

  it("leaves unknown tokens unchanged", () => {
    expect(interpolate("{{business.unknown}}", profile)).toBe(
      "{{business.unknown}}"
    );
  });
});
