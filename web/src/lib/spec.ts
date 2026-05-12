export interface SiteSection {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface SitePage {
  slug: string;
  title: string;
  meta_description: string;
  sections: SiteSection[];
}

export interface SiteSpec {
  version: 1;
  pages: SitePage[];
}

// ── Spec mutations (all return new SiteSpec, never mutate inputs) ─────────────
// When pageSlug or sectionId is not found, functions are intentionally silent
// no-ops to avoid crashes from stale UI state. Callers needing hard failures
// should validate before calling.

export function addSection(spec: SiteSpec, pageSlug: string, section: SiteSection): SiteSpec {
  return {
    ...spec,
    pages: spec.pages.map((p) =>
      p.slug === pageSlug ? { ...p, sections: [...p.sections, section] } : p
    ),
  };
}

export function removeSection(spec: SiteSpec, pageSlug: string, sectionId: string): SiteSpec {
  return {
    ...spec,
    pages: spec.pages.map((p) =>
      p.slug === pageSlug
        ? { ...p, sections: p.sections.filter((s) => s.id !== sectionId) }
        : p
    ),
  };
}

export function moveSection(
  spec: SiteSpec,
  pageSlug: string,
  sectionId: string,
  direction: "up" | "down"
): SiteSpec {
  return {
    ...spec,
    pages: spec.pages.map((p) => {
      if (p.slug !== pageSlug) return p;
      const idx = p.sections.findIndex((s) => s.id === sectionId);
      if (idx === -1) return p;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= p.sections.length) return p; // at boundary — no-op
      const sections = [...p.sections];
      [sections[idx], sections[newIdx]] = [sections[newIdx], sections[idx]];
      return { ...p, sections };
    }),
  };
}

export function updateSection(
  spec: SiteSpec,
  pageSlug: string,
  sectionId: string,
  fields: Record<string, unknown>
): SiteSpec {
  return {
    ...spec,
    pages: spec.pages.map((p) =>
      p.slug === pageSlug
        ? {
            ...p,
            sections: p.sections.map((s) =>
              s.id === sectionId ? { ...s, ...fields, id: s.id, type: s.type } : s
            ),
          }
        : p
    ),
  };
}

export function addPage(spec: SiteSpec, slug: string, title: string): SiteSpec {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`Invalid page slug: "${slug}"`);
  if (!title.trim()) throw new Error("Page title is required");
  if (spec.pages.some((p) => p.slug === slug)) throw new Error(`Page slug "${slug}" already exists`);
  return {
    ...spec,
    pages: [...spec.pages, { slug, title, meta_description: "", sections: [] }],
  };
}

export function removePage(spec: SiteSpec, slug: string): SiteSpec {
  if (slug === "index") throw new Error("Cannot remove the index page");
  if (spec.pages.length <= 1) throw new Error("Cannot remove the only page");
  return { ...spec, pages: spec.pages.filter((p) => p.slug !== slug) };
}

export function updatePage(
  spec: SiteSpec,
  slug: string,
  updates: { title?: string; meta_description?: string }
): SiteSpec {
  return {
    ...spec,
    pages: spec.pages.map((p) => (p.slug === slug ? { ...p, ...updates } : p)),
  };
}

// ── Block catalog ─────────────────────────────────────────────────────────────

export interface BlockCatalogEntry {
  type: string;
  label: string;
  description: string;
  defaultSection: () => SiteSection;
  /** Blank item templates for each array field — keyed by field name.
   *  Used by the editor to add items to empty arrays without losing field shape. */
  itemTemplates?: Record<string, Record<string, string>>;
}

function uuid(): string {
  // crypto.randomUUID is available in all modern browsers and Node 19+.
  // Fallback covers non-secure contexts and older runtimes.
  return globalThis.crypto?.randomUUID?.() ??
    `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export const BLOCK_CATALOG: BlockCatalogEntry[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Full-width headline with CTA buttons",
    defaultSection: () => ({ id: uuid(), type: "hero", headline: "Your headline here", subheadline: "A short supporting line." }),
  },
  {
    type: "features",
    label: "Features",
    description: "Icon grid of 3–6 features",
    defaultSection: () => ({
      id: uuid(), type: "features", headline: "Why choose us",
      items: [
        { icon: "star", title: "Feature one", description: "Describe this feature." },
        { icon: "check", title: "Feature two", description: "Describe this feature." },
        { icon: "users", title: "Feature three", description: "Describe this feature." },
      ],
    }),
    itemTemplates: { items: { icon: "star", title: "", description: "" } },
  },
  {
    type: "about",
    label: "About",
    description: "Text and image side by side",
    defaultSection: () => ({ id: uuid(), type: "about", headline: "About us", body: "Tell your story here." }),
  },
  {
    type: "programs",
    label: "Programs",
    description: "Grid of program cards",
    defaultSection: () => ({
      id: uuid(), type: "programs", headline: "Our programs",
      items: [{ name: "Program one", description: "What this program offers.", image_url: "", tag: "" }],
    }),
    itemTemplates: { items: { name: "", description: "", image_url: "", tag: "" } },
  },
  {
    type: "pricing",
    label: "Pricing",
    description: "Pricing tiers (1–4)",
    defaultSection: () => ({
      id: uuid(), type: "pricing", headline: "Simple pricing",
      items: [{ name: "Starter", price: "$99/mo", description: "Everything you need to get started.", features: ["Feature A", "Feature B"], cta: { text: "Get started", url: "#" } }],
    }),
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Member quote cards",
    defaultSection: () => ({
      id: uuid(), type: "testimonials", headline: "What members say",
      items: [{ quote: "This changed my life!", name: "Alex M.", role: "Member" }],
    }),
    itemTemplates: { items: { quote: "", name: "", role: "" } },
  },
  {
    type: "reviews",
    label: "Reviews",
    description: "Star-rated review cards",
    defaultSection: () => ({
      id: uuid(), type: "reviews", headline: "Member reviews",
      items: [{ text: "Absolutely love it!", author: "Jordan S.", rating: "5", platform: "Google" }],
    }),
    itemTemplates: { items: { text: "", author: "", rating: "5", platform: "Google" } },
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Expandable question list",
    defaultSection: () => ({
      id: uuid(), type: "faq", headline: "Frequently asked questions",
      items: [
        { question: "What should I expect on my first visit?", answer: "We'll walk you through everything." },
        { question: "Do I need to be fit to start?", answer: "No — all levels welcome." },
      ],
    }),
    itemTemplates: { items: { question: "", answer: "" } },
  },
  {
    type: "team",
    label: "Team",
    description: "Staff profile grid",
    defaultSection: () => ({
      id: uuid(), type: "team", headline: "Meet our coaches",
      members: [
        { name: "Alex Rivera", role: "Head Coach", bio: "10+ years of coaching experience. Specializes in strength and conditioning for athletes of all levels.", photo_url: "" },
        { name: "Jordan Hayes", role: "CrossFit Coach", bio: "CrossFit Level 2 certified. Passionate about helping beginners build confidence and consistency.", photo_url: "" },
        { name: "Morgan Kim", role: "Nutrition Coach", bio: "Certified nutrition coach focused on performance fueling and sustainable lifestyle habits.", photo_url: "" },
      ],
    }),
    itemTemplates: { members: { name: "", role: "", bio: "", photo_url: "" } },
  },
  {
    type: "gallery",
    label: "Gallery",
    description: "Photo grid",
    defaultSection: () => ({
      id: uuid(), type: "gallery", headline: "Our facility",
      images: [{ url: "", alt: "" }],
    }),
    itemTemplates: { images: { url: "", alt: "" } },
  },
  {
    type: "stats",
    label: "Stats",
    description: "Big number highlights",
    defaultSection: () => ({
      id: uuid(), type: "stats", headline: "By the numbers",
      items: [
        { value: "500+", label: "Members" },
        { value: "10", label: "Years open" },
        { value: "20+", label: "Classes/week" },
      ],
    }),
    itemTemplates: { items: { value: "", label: "" } },
  },
  {
    type: "video",
    label: "Video",
    description: "YouTube or Vimeo embed",
    defaultSection: () => ({ id: uuid(), type: "video", headline: "See us in action", url: "" }),
  },
  {
    type: "intro-offer",
    label: "Intro offer",
    description: "Free trial CTA section",
    defaultSection: () => ({ id: uuid(), type: "intro-offer", headline: "Try us free", price: "$0", period: "for 30 days", details: "No commitment required.", cta: { text: "Claim your free trial", url: "#" } }),
  },
  {
    type: "map-location",
    label: "Location",
    description: "Map, address, and hours",
    defaultSection: () => ({ id: uuid(), type: "map-location", headline: "Find us" }),
  },
  {
    type: "rich-text",
    label: "Rich text",
    description: "Custom HTML content",
    defaultSection: () => ({ id: uuid(), type: "rich-text", headline: "More info", html: "<p>Add your content here.</p>" }),
  },
  {
    type: "cta-banner",
    label: "CTA banner",
    description: "Full-width call to action",
    defaultSection: () => ({ id: uuid(), type: "cta-banner", headline: "Ready to start?", cta_primary: { text: "Get started", url: "#" } }),
  },
];
