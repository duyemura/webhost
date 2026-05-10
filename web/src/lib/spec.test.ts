import { describe, it, expect } from "vitest";
import {
  addSection,
  removeSection,
  moveSection,
  updateSection,
  addPage,
  removePage,
  updatePage,
  BLOCK_CATALOG,
  type SiteSpec,
} from "./spec";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const s1 = { id: "s1", type: "hero", headline: "Welcome" };
const s2 = { id: "s2", type: "stats", items: [] };
const s3 = { id: "s3", type: "faq", items: [] };

const baseSpec: SiteSpec = {
  version: 1,
  pages: [
    { slug: "index", title: "Home", meta_description: "", sections: [s1, s2, s3] },
    { slug: "contact", title: "Contact", meta_description: "", sections: [] },
  ],
};

// ── addSection ────────────────────────────────────────────────────────────────

describe("addSection()", () => {
  const newSection = { id: "s4", type: "cta-banner", headline: "Join now" };

  it("appends section to the correct page", () => {
    const result = addSection(baseSpec, "index", newSection);
    expect(result.pages[0].sections).toHaveLength(4);
    expect(result.pages[0].sections[3]).toEqual(newSection);
  });

  it("leaves other pages unchanged", () => {
    const result = addSection(baseSpec, "index", newSection);
    expect(result.pages[1].sections).toHaveLength(0);
  });

  it("does not mutate the original spec", () => {
    addSection(baseSpec, "index", newSection);
    expect(baseSpec.pages[0].sections).toHaveLength(3);
  });

  it("no-ops silently when page slug not found", () => {
    const result = addSection(baseSpec, "nonexistent", newSection);
    expect(result.pages[0].sections).toHaveLength(3);
  });
});

// ── removeSection ─────────────────────────────────────────────────────────────

describe("removeSection()", () => {
  it("removes section by ID", () => {
    const result = removeSection(baseSpec, "index", "s2");
    const ids = result.pages[0].sections.map((s) => s.id);
    expect(ids).toEqual(["s1", "s3"]);
  });

  it("leaves other pages unchanged", () => {
    const result = removeSection(baseSpec, "index", "s1");
    expect(result.pages[1]).toEqual(baseSpec.pages[1]);
  });

  it("does not mutate the original spec", () => {
    removeSection(baseSpec, "index", "s1");
    expect(baseSpec.pages[0].sections).toHaveLength(3);
  });

  it("is a no-op when section ID not found", () => {
    const result = removeSection(baseSpec, "index", "nonexistent");
    expect(result.pages[0].sections).toHaveLength(3);
  });
});

// ── moveSection ───────────────────────────────────────────────────────────────

describe("moveSection()", () => {
  it("moves section up by one", () => {
    const result = moveSection(baseSpec, "index", "s2", "up");
    const ids = result.pages[0].sections.map((s) => s.id);
    expect(ids).toEqual(["s2", "s1", "s3"]);
  });

  it("moves section down by one", () => {
    const result = moveSection(baseSpec, "index", "s2", "down");
    const ids = result.pages[0].sections.map((s) => s.id);
    expect(ids).toEqual(["s1", "s3", "s2"]);
  });

  it("is a no-op when moving first section up", () => {
    const result = moveSection(baseSpec, "index", "s1", "up");
    const ids = result.pages[0].sections.map((s) => s.id);
    expect(ids).toEqual(["s1", "s2", "s3"]);
  });

  it("is a no-op when moving last section down", () => {
    const result = moveSection(baseSpec, "index", "s3", "down");
    const ids = result.pages[0].sections.map((s) => s.id);
    expect(ids).toEqual(["s1", "s2", "s3"]);
  });

  it("leaves other pages unchanged", () => {
    const result = moveSection(baseSpec, "index", "s2", "up");
    expect(result.pages[1]).toEqual(baseSpec.pages[1]);
  });

  it("does not mutate the original spec", () => {
    moveSection(baseSpec, "index", "s2", "up");
    expect(baseSpec.pages[0].sections.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });
});

// ── updateSection ─────────────────────────────────────────────────────────────

describe("updateSection()", () => {
  it("merges new fields into section", () => {
    const result = updateSection(baseSpec, "index", "s1", { headline: "New headline", cta: { text: "Go" } });
    expect(result.pages[0].sections[0].headline).toBe("New headline");
    expect(result.pages[0].sections[0].cta).toEqual({ text: "Go" });
  });

  it("preserves id and type — cannot be overwritten", () => {
    const result = updateSection(baseSpec, "index", "s1", { id: "HACKED", type: "HACKED" });
    expect(result.pages[0].sections[0].id).toBe("s1");
    expect(result.pages[0].sections[0].type).toBe("hero");
  });

  it("leaves other sections unchanged", () => {
    const result = updateSection(baseSpec, "index", "s1", { headline: "Changed" });
    expect(result.pages[0].sections[1]).toEqual(s2);
    expect(result.pages[0].sections[2]).toEqual(s3);
  });

  it("does not mutate the original spec", () => {
    updateSection(baseSpec, "index", "s1", { headline: "Changed" });
    expect(baseSpec.pages[0].sections[0].headline).toBe("Welcome");
  });
});

// ── addPage ───────────────────────────────────────────────────────────────────

describe("addPage()", () => {
  it("appends a new page", () => {
    const result = addPage(baseSpec, "about", "About Us");
    expect(result.pages).toHaveLength(3);
    expect(result.pages[2].slug).toBe("about");
    expect(result.pages[2].title).toBe("About Us");
    expect(result.pages[2].sections).toEqual([]);
    expect(result.pages[2].meta_description).toBe("");
  });

  it("throws if title is empty", () => {
    expect(() => addPage(baseSpec, "about", "")).toThrow(/required/);
    expect(() => addPage(baseSpec, "about", "   ")).toThrow(/required/);
  });

  it("throws if slug already exists", () => {
    expect(() => addPage(baseSpec, "index", "Home Again")).toThrow(/already exists/);
    expect(() => addPage(baseSpec, "contact", "Contact Again")).toThrow(/already exists/);
  });

  it("throws on invalid slug — uppercase", () => {
    expect(() => addPage(baseSpec, "About", "About")).toThrow(/Invalid page slug/);
  });

  it("throws on invalid slug — spaces", () => {
    expect(() => addPage(baseSpec, "my page", "My Page")).toThrow(/Invalid page slug/);
  });

  it("throws on invalid slug — special characters", () => {
    expect(() => addPage(baseSpec, "about!", "About")).toThrow(/Invalid page slug/);
  });

  it("accepts valid slugs with hyphens and numbers", () => {
    expect(() => addPage(baseSpec, "about-us-2", "About")).not.toThrow();
  });

  it("does not mutate the original spec", () => {
    addPage(baseSpec, "about", "About");
    expect(baseSpec.pages).toHaveLength(2);
  });
});

// ── removePage ────────────────────────────────────────────────────────────────

describe("removePage()", () => {
  it("removes page by slug", () => {
    const result = removePage(baseSpec, "contact");
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].slug).toBe("index");
  });

  it("throws when removing the index page", () => {
    expect(() => removePage(baseSpec, "index")).toThrow(/index/);
  });

  it("throws when only one page remains", () => {
    const singlePage: SiteSpec = { version: 1, pages: [baseSpec.pages[0]] };
    expect(() => removePage(singlePage, "index")).toThrow();
  });

  it("does not mutate the original spec", () => {
    removePage(baseSpec, "contact");
    expect(baseSpec.pages).toHaveLength(2);
  });
});

// ── updatePage ────────────────────────────────────────────────────────────────

describe("updatePage()", () => {
  it("updates title", () => {
    const result = updatePage(baseSpec, "index", { title: "Homepage" });
    expect(result.pages[0].title).toBe("Homepage");
  });

  it("updates meta_description", () => {
    const result = updatePage(baseSpec, "index", { meta_description: "Great gym in Las Vegas" });
    expect(result.pages[0].meta_description).toBe("Great gym in Las Vegas");
  });

  it("leaves other pages unchanged", () => {
    const result = updatePage(baseSpec, "index", { title: "Changed" });
    expect(result.pages[1]).toEqual(baseSpec.pages[1]);
  });

  it("does not mutate the original spec", () => {
    updatePage(baseSpec, "index", { title: "Changed" });
    expect(baseSpec.pages[0].title).toBe("Home");
  });
});

// ── BLOCK_CATALOG ─────────────────────────────────────────────────────────────

const EXPECTED_TYPES = [
  "hero", "features", "about", "programs", "pricing", "testimonials",
  "reviews", "faq", "team", "gallery", "stats", "video",
  "intro-offer", "map-location", "rich-text", "cta-banner",
];

describe("BLOCK_CATALOG", () => {
  it("exports all 16 block types", () => {
    const types = BLOCK_CATALOG.map((b) => b.type);
    expect(types).toEqual(expect.arrayContaining(EXPECTED_TYPES));
    expect(BLOCK_CATALOG).toHaveLength(16);
  });

  it("every entry has label and description", () => {
    for (const entry of BLOCK_CATALOG) {
      expect(entry.label).toBeTruthy();
      expect(entry.description).toBeTruthy();
    }
  });

  it("every defaultSection() returns an object with id and type", () => {
    for (const entry of BLOCK_CATALOG) {
      const section = entry.defaultSection();
      expect(section.id).toBeTruthy();
      expect(section.type).toBe(entry.type);
    }
  });

  it("every defaultSection() includes at least one content field beyond id/type", () => {
    for (const entry of BLOCK_CATALOG) {
      const section = entry.defaultSection();
      const keys = Object.keys(section).filter((k) => k !== "id" && k !== "type");
      expect(keys.length).toBeGreaterThan(0);
    }
  });

  it("consecutive calls to defaultSection() produce different IDs", () => {
    for (const entry of BLOCK_CATALOG) {
      const a = entry.defaultSection();
      const b = entry.defaultSection();
      expect(a.id).not.toBe(b.id);
    }
  });
});
