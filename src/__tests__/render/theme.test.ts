import { describe, it, expect } from "vitest";
import { themeToCSS, googleFontsUrl } from "../../render/theme.js";
import { DEFAULT_THEME } from "../../blocks/types.js";
import { THEME_PRESETS } from "../../render/theme-presets.js";

describe("themeToCSS()", () => {
  it("outputs :root block", () => {
    const css = themeToCSS(DEFAULT_THEME);
    expect(css).toMatch(/^:root \{/);
    expect(css).toMatch(/\}$/);
  });

  it("maps color tokens to CSS variables", () => {
    const css = themeToCSS(DEFAULT_THEME);
    expect(css).toContain("--color-primary: #111827");
    expect(css).toContain("--color-bg: #ffffff");
    expect(css).toContain("--color-fg: #111111");
    expect(css).toContain("--color-border: #e5e7eb");
  });

  it("maps font variables", () => {
    const css = themeToCSS(DEFAULT_THEME);
    expect(css).toContain("--font-heading: 'Inter'");
    expect(css).toContain("--font-body: 'Inter'");
  });

  it("maps radius enum to px value", () => {
    expect(themeToCSS(DEFAULT_THEME)).toContain("--radius: 8px"); // md = 8px
    expect(themeToCSS({ ...DEFAULT_THEME, shape: { radius: "none" } })).toContain("--radius: 0");
    expect(themeToCSS({ ...DEFAULT_THEME, shape: { radius: "full" } })).toContain("--radius: 9999px");
  });

  it("maps heading_tracking enum to em value", () => {
    const tight = themeToCSS({ ...DEFAULT_THEME, typography: { ...DEFAULT_THEME.typography, heading_tracking: "tight" } });
    const wide = themeToCSS({ ...DEFAULT_THEME, typography: { ...DEFAULT_THEME.typography, heading_tracking: "wide" } });
    const normal = themeToCSS({ ...DEFAULT_THEME, typography: { ...DEFAULT_THEME.typography, heading_tracking: "normal" } });
    expect(tight).toContain("--heading-tracking: -0.025em");
    expect(wide).toContain("--heading-tracking: 0.05em");
    expect(normal).toContain("--heading-tracking: 0");
  });

  it("maps section_padding enum to rem value", () => {
    expect(themeToCSS({ ...DEFAULT_THEME, spacing: { section_padding: "compact" } })).toContain("--section-padding: 3rem 0");
    expect(themeToCSS({ ...DEFAULT_THEME, spacing: { section_padding: "loose" } })).toContain("--section-padding: 8rem 0");
  });
});

describe("googleFontsUrl()", () => {
  it("returns a Google Fonts URL", () => {
    const url = googleFontsUrl(DEFAULT_THEME);
    expect(url).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/);
    expect(url).toContain("display=swap");
  });

  it("includes the heading font family", () => {
    const url = googleFontsUrl(DEFAULT_THEME);
    expect(url).toContain("Inter");
  });

  it("deduplicates when heading and body fonts are the same", () => {
    const url = googleFontsUrl(DEFAULT_THEME); // both "Inter"
    const matches = url.match(/family=/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it("includes both fonts when they differ", () => {
    const theme = {
      ...DEFAULT_THEME,
      typography: { ...DEFAULT_THEME.typography, heading_font: "Oswald", body_font: "Open Sans" },
    };
    const url = googleFontsUrl(theme);
    expect(url).toContain("Oswald");
    expect(url).toContain("Open%20Sans");
  });
});

describe("THEME_PRESETS", () => {
  const presetNames = ["bold", "professional", "warm", "dark", "minimal", "energetic"];

  it("exports all 6 named presets", () => {
    expect(Object.keys(THEME_PRESETS)).toEqual(expect.arrayContaining(presetNames));
    expect(Object.keys(THEME_PRESETS)).toHaveLength(6);
  });

  for (const name of presetNames) {
    it(`${name} preset has all required theme fields`, () => {
      const preset = THEME_PRESETS[name];
      expect(preset).toBeDefined();
      expect(preset.colors.primary).toBeTruthy();
      expect(preset.colors.background).toBeTruthy();
      expect(preset.typography.heading_font).toBeTruthy();
      expect(["none", "sm", "md", "lg", "full"]).toContain(preset.shape.radius);
      expect(["compact", "normal", "loose"]).toContain(preset.spacing.section_padding);
    });
  }

  it("bold preset has red primary color", () => {
    expect(THEME_PRESETS["bold"].colors.primary).toBe("#e63946");
  });

  it("dark preset has dark background", () => {
    expect(THEME_PRESETS["dark"].colors.background).toBe("#111111");
  });
});
