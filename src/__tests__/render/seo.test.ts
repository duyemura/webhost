import { describe, it, expect } from "vitest";
import { siteBaseUrl, buildSeoSnippets } from "../../render/seo.js";
import type { BusinessProfile } from "../../db/types.js";

const site = { slug: "my-gym", custom_domain: null as string | null };

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
  description: "Premier CrossFit gym in Las Vegas",
  zip: "89101",
  country: "US",
  website_url: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe("siteBaseUrl()", () => {
  it("uses custom domain when set", () => {
    expect(siteBaseUrl({ slug: "my-gym", custom_domain: "mygym.com" })).toBe(
      "https://mygym.com"
    );
  });

  it("falls back to slug.baseDomain when no custom domain", () => {
    const url = siteBaseUrl({ slug: "my-gym", custom_domain: null });
    expect(url).toMatch(/^https:\/\/my-gym\./);
  });
});

describe("buildSeoSnippets()", () => {
  it("injects canonical and og:url when missing", () => {
    const snippets = buildSeoSnippets(site, null, "", "/");
    expect(snippets).toContain('rel="canonical"');
    expect(snippets).toContain('property="og:url"');
  });

  it("does not inject canonical when already present", () => {
    const html = `<link rel="canonical" href="https://example.com">`;
    const snippets = buildSeoSnippets(site, null, html, "/");
    expect(snippets).not.toContain('rel="canonical"');
  });

  it("injects og:type website when missing", () => {
    const snippets = buildSeoSnippets(site, null, "", "/");
    expect(snippets).toContain('property="og:type" content="website"');
  });

  it("injects og:title and twitter:title from <title> tag", () => {
    const html = `<title>My Gym</title>`;
    const snippets = buildSeoSnippets(site, null, html, "/");
    expect(snippets).toContain('property="og:title" content="My Gym"');
    expect(snippets).toContain('name="twitter:title" content="My Gym"');
  });

  it("injects description tags from profile", () => {
    const snippets = buildSeoSnippets(site, profile, "", "/");
    expect(snippets).toContain('name="description"');
    expect(snippets).toContain('property="og:description"');
    expect(snippets).toContain('name="twitter:description"');
    expect(snippets).toContain("Premier CrossFit gym in Las Vegas");
  });

  it("escapes special characters in meta content attributes", () => {
    const xssProfile: BusinessProfile = {
      ...profile,
      description: `Gym with "quotes" & <tags>` as string | null,
    };
    const snippets = buildSeoSnippets(site, xssProfile, "", "/");
    // Meta content attributes must have escaped values
    expect(snippets).toContain('content="Gym with &quot;quotes&quot; &amp; &lt;tags&gt;"');
    // Raw unescaped values must not appear inside content="..." attributes
    expect(snippets).not.toContain('content="Gym with "'); // unescaped quote breaks attribute
  });

  it("injects twitter:card summary_large_image", () => {
    const snippets = buildSeoSnippets(site, null, "", "/");
    expect(snippets).toContain('content="summary_large_image"');
  });

  it("injects JSON-LD LocalBusiness schema when profile has biz_name", () => {
    const snippets = buildSeoSnippets(site, profile, "", "/");
    expect(snippets).toContain("application/ld+json");
    expect(snippets).toContain('"LocalBusiness"');
    expect(snippets).toContain('"Iron Works CrossFit"');
  });

  it("builds correct page URL for sub-paths", () => {
    const snippets = buildSeoSnippets(site, null, "", "/contact");
    expect(snippets).toContain("/contact");
  });

  it("does not double-inject tags already in html", () => {
    const html = `
      <link rel="canonical" href="x">
      <meta property="og:url" content="x">
      <meta property="og:type" content="website">
      <meta name="twitter:card" content="summary_large_image">
    `;
    const snippets = buildSeoSnippets(site, null, html, "/");
    expect(snippets.trim()).toBe("");
  });
});
