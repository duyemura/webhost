import type { Theme } from "../blocks/types.js";

const bold: Theme = {
  colors: {
    primary: "#111827",
    primary_foreground: "#ffffff",
    secondary: "#374151",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#111111",
    muted: "#f5f5f5",
    muted_foreground: "#6b7280",
    accent: "#111827",
    border: "#e5e7eb",
    surface: "#f9fafb",
  },
  typography: {
    heading_font: "Barlow Condensed",
    body_font: "Inter",
    heading_weight: "900",
    heading_transform: "uppercase",
    heading_tracking: "tight",
    heading_scale: "xl",
  },
  shape: { radius: "none" },
  spacing: { section_padding: "normal" },
  style_hint: "bold energetic crossfit strength gym",
};

const professional: Theme = {
  colors: {
    primary: "#111827",
    primary_foreground: "#ffffff",
    secondary: "#374151",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f8fafc",
    muted_foreground: "#64748b",
    accent: "#111827",
    border: "#e2e8f0",
    surface: "#f8fafc",
  },
  typography: {
    heading_font: "Playfair Display",
    body_font: "Inter",
    heading_weight: "700",
    heading_transform: "none",
    heading_tracking: "tight",
    heading_scale: "large",
  },
  shape: { radius: "sm" },
  spacing: { section_padding: "normal" },
  style_hint: "professional corporate clean elegant",
};

const warm: Theme = {
  colors: {
    primary: "#111827",
    primary_foreground: "#ffffff",
    secondary: "#374151",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#1c1917",
    muted: "#f9fafb",
    muted_foreground: "#6b7280",
    accent: "#111827",
    border: "#e5e7eb",
    surface: "#f9fafb",
  },
  typography: {
    heading_font: "Nunito",
    body_font: "Nunito",
    heading_weight: "800",
    heading_transform: "none",
    heading_tracking: "normal",
    heading_scale: "large",
  },
  shape: { radius: "lg" },
  spacing: { section_padding: "normal" },
  style_hint: "warm welcoming community friendly yoga wellness",
};

const dark: Theme = {
  colors: {
    primary: "#f9fafb",
    primary_foreground: "#111111",
    secondary: "#1c1c1c",
    secondary_foreground: "#ffffff",
    background: "#111111",
    foreground: "#f9fafb",
    muted: "#1a1a1a",
    muted_foreground: "#9ca3af",
    accent: "#f9fafb",
    border: "#2a2a2a",
    surface: "#1c1c1c",
  },
  typography: {
    heading_font: "Barlow Condensed",
    body_font: "Inter",
    heading_weight: "900",
    heading_transform: "uppercase",
    heading_tracking: "tight",
    heading_scale: "xl",
  },
  shape: { radius: "none" },
  spacing: { section_padding: "loose" },
  style_hint: "dark-industrial",
};

const minimal: Theme = {
  colors: {
    primary: "#111827",
    primary_foreground: "#ffffff",
    secondary: "#6b7280",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#111827",
    muted: "#f9fafb",
    muted_foreground: "#6b7280",
    accent: "#111827",
    border: "#e5e7eb",
    surface: "#f9fafb",
  },
  typography: {
    heading_font: "DM Sans",
    body_font: "DM Sans",
    heading_weight: "700",
    heading_transform: "none",
    heading_tracking: "tight",
    heading_scale: "large",
  },
  shape: { radius: "none" },
  spacing: { section_padding: "loose" },
  style_hint: "minimal clean zen simple pilates studio",
};

export const THEME_PRESETS: Record<string, Theme> = {
  bold,
  professional,
  warm,
  dark,
  minimal,
};
