import type { z } from "zod";
import type { BusinessProfile } from "../db/types.js";

export interface Theme {
  colors: {
    primary: string;
    primary_foreground: string;
    secondary: string;
    secondary_foreground: string;
    background: string;
    foreground: string;
    muted: string;
    muted_foreground: string;
    accent: string;
    border: string;
    surface: string;
  };
  typography: {
    heading_font: string;
    body_font: string;
    heading_weight: string;
    heading_transform: string;
    heading_tracking: string;
  };
  shape: { radius: "none" | "sm" | "md" | "lg" | "full" };
  spacing: { section_padding: "compact" | "normal" | "loose" };
  style_hint: string;
}

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

export interface BlockDefinition {
  type: string;
  schema: z.ZodTypeAny;
  render: (section: Record<string, unknown>, theme: Theme, profile: BusinessProfile | null) => string;
  aiSchema: object;
}

export const DEFAULT_THEME: Theme = {
  colors: {
    primary: "#111827",
    primary_foreground: "#ffffff",
    secondary: "#374151",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#111111",
    muted: "#f9fafb",
    muted_foreground: "#6b7280",
    accent: "#111827",
    border: "#e5e7eb",
    surface: "#f9fafb",
  },
  typography: {
    heading_font: "Inter",
    body_font: "Inter",
    heading_weight: "700",
    heading_transform: "none",
    heading_tracking: "tight",
  },
  shape: { radius: "md" },
  spacing: { section_padding: "normal" },
  style_hint: "clean",
};
