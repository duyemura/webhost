import { describe, it, expect } from "vitest";
import { specSchema, themeSchema, cssColor, fontName } from "../../routes/schemas.js";

// ── specSchema ──────────────────────────────────────────────────────────────

const validSpec = {
  version: 1 as const,
  pages: [
    {
      slug: "index",
      title: "Home",
      sections: [{ id: "h1", type: "hero", headline: "Welcome" }],
    },
  ],
};

describe("specSchema", () => {
  it("accepts a valid spec", () => {
    expect(specSchema.safeParse(validSpec).success).toBe(true);
  });

  it("requires first page slug to be 'index'", () => {
    const bad = { ...validSpec, pages: [{ ...validSpec.pages[0], slug: "home" }] };
    const result = specSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const msg = result.error.issues.map(i => i.message).join(";");
      expect(msg).toContain("index");
    }
  });

  it("rejects version other than 1", () => {
    expect(specSchema.safeParse({ ...validSpec, version: 2 }).success).toBe(false);
  });

  it("rejects empty pages array", () => {
    expect(specSchema.safeParse({ ...validSpec, pages: [] }).success).toBe(false);
  });

  it("rejects slug with uppercase letters", () => {
    const bad = { ...validSpec, pages: [{ ...validSpec.pages[0], slug: "Index" }] };
    expect(specSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects slug with spaces", () => {
    const bad = { ...validSpec, pages: [{ ...validSpec.pages[0], slug: "my page" }] };
    expect(specSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts multiple pages when first is index", () => {
    const multi = {
      ...validSpec,
      pages: [
        validSpec.pages[0],
        { slug: "contact", title: "Contact", sections: [{ id: "m1", type: "map-location" }] },
      ],
    };
    expect(specSchema.safeParse(multi).success).toBe(true);
  });

  it("accepts optional meta_description and defaults to empty string", () => {
    const result = specSchema.safeParse(validSpec);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pages[0].meta_description).toBe("");
    }
  });

  it("rejects meta_description over 300 chars", () => {
    const bad = {
      ...validSpec,
      pages: [{ ...validSpec.pages[0], meta_description: "x".repeat(301) }],
    };
    expect(specSchema.safeParse(bad).success).toBe(false);
  });
});

// ── themeSchema ─────────────────────────────────────────────────────────────

const validTheme = {
  colors: {
    primary: "#e63946",
    primary_foreground: "#ffffff",
    secondary: "#111827",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#111111",
    muted: "#f5f5f5",
    muted_foreground: "#6b7280",
    accent: "#e63946",
    border: "#e5e7eb",
    surface: "#f9fafb",
  },
  typography: {
    heading_font: "Inter",
    body_font: "Open Sans",
    heading_weight: "700" as const,
    heading_transform: "none" as const,
    heading_tracking: "tight" as const,
  },
  shape: { radius: "md" as const },
  spacing: { section_padding: "normal" as const },
  style_hint: "clean",
};

describe("themeSchema", () => {
  it("accepts a valid theme", () => {
    expect(themeSchema.safeParse(validTheme).success).toBe(true);
  });

  it("accepts rgb() color values", () => {
    const theme = { ...validTheme, colors: { ...validTheme.colors, primary: "rgb(230, 57, 70)" } };
    expect(themeSchema.safeParse(theme).success).toBe(true);
  });

  it("accepts hsl() color values", () => {
    const theme = { ...validTheme, colors: { ...validTheme.colors, primary: "hsl(354, 70%, 56%)" } };
    expect(themeSchema.safeParse(theme).success).toBe(true);
  });

  it("accepts named color keywords", () => {
    const theme = { ...validTheme, colors: { ...validTheme.colors, primary: "red" } };
    expect(themeSchema.safeParse(theme).success).toBe(true);
  });

  it("rejects CSS injection in color values", () => {
    const injections = [
      "#fff; background: red",
      "red; --color-primary: blue",
      "url('https://evil.com')",
      "expression(alert(1))",
    ];
    for (const injection of injections) {
      const theme = { ...validTheme, colors: { ...validTheme.colors, primary: injection } };
      expect(themeSchema.safeParse(theme).success).toBe(false);
    }
  });

  it("rejects font names with CSS injection characters", () => {
    const injections = [
      "Inter; font-size: 0",
      "Inter', serif",
      "Inter\"; color: red",
      "<script>",
    ];
    for (const injection of injections) {
      const theme = { ...validTheme, typography: { ...validTheme.typography, heading_font: injection } };
      expect(themeSchema.safeParse(theme).success).toBe(false);
    }
  });

  it("rejects heading_weight values outside the allowed enum", () => {
    const theme = { ...validTheme, typography: { ...validTheme.typography, heading_weight: "300" } };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it("rejects heading_transform values outside the allowed enum", () => {
    const theme = { ...validTheme, typography: { ...validTheme.typography, heading_transform: "smallcaps" } };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it("rejects radius values outside the allowed enum", () => {
    const theme = { ...validTheme, shape: { radius: "2xl" } };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });

  it("rejects section_padding values outside the allowed enum", () => {
    const theme = { ...validTheme, spacing: { section_padding: "xlarge" } };
    expect(themeSchema.safeParse(theme).success).toBe(false);
  });
});

// ── cssColor primitive ────────────────────────────────────────────────────────

describe("cssColor validator", () => {
  const valid = ["#fff", "#ffffff", "#ffffffff", "rgb(0,0,0)", "rgba(0,0,0,0.5)", "hsl(0,0%,0%)", "red", "transparent"];
  const invalid = ["#fff; x:y", "red; color:blue", "url(x)", "expression(x)", "", ";", "'red'", '"red"'];

  for (const v of valid) {
    it(`accepts "${v}"`, () => expect(cssColor.safeParse(v).success).toBe(true));
  }

  for (const v of invalid) {
    it(`rejects "${v}"`, () => expect(cssColor.safeParse(v).success).toBe(false));
  }
});

// ── fontName primitive ────────────────────────────────────────────────────────

describe("fontName validator", () => {
  const valid = ["Inter", "Open Sans", "Roboto Condensed", "PT Sans Caption"];
  const invalid = ["Inter;color:red", "Inter'", 'Inter"', "<script>", "a".repeat(81)];

  for (const v of valid) {
    it(`accepts "${v}"`, () => expect(fontName.safeParse(v).success).toBe(true));
  }

  for (const v of invalid) {
    it(`rejects "${v}"`, () => expect(fontName.safeParse(v).success).toBe(false));
  }
});
