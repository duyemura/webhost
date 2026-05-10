import type { Theme } from "../blocks/types.js";

const bold: Theme = {
  colors: {
    primary: "#e63946",
    primary_foreground: "#ffffff",
    secondary: "#111111",
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
    primary: "#1e40af",
    primary_foreground: "#ffffff",
    secondary: "#1e3a5f",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#0f172a",
    muted: "#f8fafc",
    muted_foreground: "#64748b",
    accent: "#1e40af",
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
    primary: "#ea580c",
    primary_foreground: "#ffffff",
    secondary: "#7c2d12",
    secondary_foreground: "#ffffff",
    background: "#fffbf7",
    foreground: "#1c1917",
    muted: "#fef3c7",
    muted_foreground: "#78350f",
    accent: "#ea580c",
    border: "#fed7aa",
    surface: "#fff7ed",
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
    primary: "#e63946",
    primary_foreground: "#ffffff",
    secondary: "#1c1c1c",
    secondary_foreground: "#ffffff",
    background: "#111111",
    foreground: "#f9fafb",
    muted: "#1a1a1a",
    muted_foreground: "#9ca3af",
    accent: "#e63946",
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
    primary: "#374151",
    primary_foreground: "#ffffff",
    secondary: "#6b7280",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#111827",
    muted: "#f9fafb",
    muted_foreground: "#6b7280",
    accent: "#374151",
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

const energetic: Theme = {
  colors: {
    primary: "#16a34a",
    primary_foreground: "#ffffff",
    secondary: "#14532d",
    secondary_foreground: "#ffffff",
    background: "#ffffff",
    foreground: "#111827",
    muted: "#f0fdf4",
    muted_foreground: "#4b7c5b",
    accent: "#16a34a",
    border: "#bbf7d0",
    surface: "#f0fdf4",
  },
  typography: {
    heading_font: "Montserrat",
    body_font: "Inter",
    heading_weight: "800",
    heading_transform: "uppercase",
    heading_tracking: "tight",
    heading_scale: "large",
  },
  shape: { radius: "md" },
  spacing: { section_padding: "normal" },
  style_hint: "energetic health outdoor fitness running cycling",
};

export const THEME_PRESETS: Record<string, Theme> = {
  bold,
  professional,
  warm,
  dark,
  minimal,
  energetic,
};
