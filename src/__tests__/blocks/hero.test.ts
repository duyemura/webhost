import { describe, it, expect } from "vitest";
import { render } from "../../blocks/hero/renderer.js";
import { DEFAULT_THEME } from "../../blocks/types.js";
import type { BusinessProfile } from "../../db/types.js";

const theme = DEFAULT_THEME;
const profile: BusinessProfile = {
  id: "p1",
  site_id: "s1",
  biz_name: "Iron Works CrossFit",
  city: "Las Vegas",
  state: "NV",
  phone: null,
  email: null,
  address: null,
  hours: null,
  description: null,
  zip: null,
  country: "US",
  website_url: null,
  gmb_rating: null,
  gmb_review_count: null,
  created_at: new Date(),
  updated_at: new Date(),
};

function section(fields: Record<string, unknown>) {
  return { id: "h1", type: "hero", ...fields };
}

describe("hero renderer", () => {
  it("renders headline in <h1>", () => {
    const html = render(section({ headline: "Strength Is Earned" }), theme, null);
    expect(html).toContain("<h1>Strength Is Earned</h1>");
  });

  it("renders subheadline as <p>", () => {
    const html = render(section({ headline: "H", subheadline: "Join us today" }), theme, null);
    expect(html).toContain("<p class=\"block-hero__sub\">Join us today</p>");
  });

  it("omits subheadline element when not set", () => {
    const html = render(section({ headline: "H" }), theme, null);
    expect(html).not.toContain("block-hero__sub");
  });

  it("renders primary CTA button", () => {
    const html = render(section({ headline: "H", cta_primary: { text: "Get started", url: "/signup" } }), theme, null);
    expect(html).toContain('href="/signup"');
    expect(html).toContain("Get started");
    expect(html).toContain("btn-primary");
  });

  it("renders secondary CTA button", () => {
    const html = render(section({ headline: "H", cta_secondary: { text: "Learn more", url: "/about" } }), theme, null);
    expect(html).toContain('href="/about"');
    expect(html).toContain("btn-secondary");
  });

  it("adds dark class for dark background style", () => {
    const html = render(section({ headline: "H", background: { style: "dark" } }), theme, null);
    expect(html).toContain("block-hero--dark");
  });

  it("adds media class and img tag for image background", () => {
    const html = render(section({ headline: "H", background: { style: "image", value: "https://example.com/bg.jpg" } }), theme, null);
    expect(html).toContain("block-hero--media");
    expect(html).toContain('src="https://example.com/bg.jpg"');
  });

  it("adds color background style", () => {
    const html = render(section({ headline: "H", background: { style: "color", value: "#ff0000" } }), theme, null);
    expect(html).toContain('style="background:#ff0000"');
  });

  it("interpolates {{business.name}} token in headline", () => {
    const html = render(section({ headline: "Welcome to {{business.name}}!" }), theme, profile);
    expect(html).toContain("Welcome to Iron Works CrossFit!");
  });

  it("escapes XSS in headline", () => {
    const html = render(section({ headline: '<script>alert(1)</script>' }), theme, null);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("blocks javascript: scheme in CTA URL (safeUrl)", () => {
    const html = render(section({ headline: "H", cta_primary: { text: "Go", url: "javascript:alert(1)" } }), theme, null);
    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="#"');
  });

  it("wraps output in <section class=\"block-hero\">", () => {
    const html = render(section({ headline: "H" }), theme, null);
    expect(html).toMatch(/^<section class="block-hero/);
    expect(html).toContain("</section>");
  });
});
