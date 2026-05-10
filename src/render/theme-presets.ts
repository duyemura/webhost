import type { Theme } from "../blocks/types.js";

const bold: Theme = {
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
  typography: { heading_font: "Inter", body_font: "Inter", heading_weight: "800", heading_transform: "none", heading_tracking: "tight" },
  shape: { radius: "md" },
  spacing: { section_padding: "normal" },
  style_hint: "bold energetic crossfit",
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
  typography: { heading_font: "Inter", body_font: "Inter", heading_weight: "700", heading_transform: "none", heading_tracking: "tight" },
  shape: { radius: "sm" },
  spacing: { section_padding: "normal" },
  style_hint: "professional corporate clean",
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
  typography: { heading_font: "Inter", body_font: "Inter", heading_weight: "700", heading_transform: "none", heading_tracking: "normal" },
  shape: { radius: "lg" },
  spacing: { section_padding: "normal" },
  style_hint: "warm welcoming community friendly",
};

const dark: Theme = {
  colors: {
    primary: "#ffffff",
    primary_foreground: "#111827",
    secondary: "#374151",
    secondary_foreground: "#ffffff",
    background: "#111827",
    foreground: "#f9fafb",
    muted: "#1f2937",
    muted_foreground: "#9ca3af",
    accent: "#f9fafb",
    border: "#374151",
    surface: "#1f2937",
  },
  typography: { heading_font: "Inter", body_font: "Inter", heading_weight: "800", heading_transform: "none", heading_tracking: "tight" },
  shape: { radius: "md" },
  spacing: { section_padding: "normal" },
  style_hint: "dark premium upscale sleek",
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
  typography: { heading_font: "Inter", body_font: "Inter", heading_weight: "600", heading_transform: "none", heading_tracking: "normal" },
  shape: { radius: "none" },
  spacing: { section_padding: "loose" },
  style_hint: "minimal clean zen simple",
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
  typography: { heading_font: "Inter", body_font: "Inter", heading_weight: "700", heading_transform: "none", heading_tracking: "tight" },
  shape: { radius: "lg" },
  spacing: { section_padding: "normal" },
  style_hint: "energetic health outdoor fitness",
};

export const THEME_PRESETS: Record<string, Theme> = {
  bold,
  professional,
  warm,
  dark,
  minimal,
  energetic,
};
