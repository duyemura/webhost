import type { Theme } from "../blocks/types.js";

const RADIUS_MAP: Record<Theme["shape"]["radius"], string> = {
  none: "0",
  sm: "4px",
  md: "8px",
  lg: "16px",
  full: "9999px",
};

const PADDING_MAP: Record<Theme["spacing"]["section_padding"], string> = {
  compact: "3rem 0",
  normal: "5rem 0",
  loose: "8rem 0",
};

const SCALE_MAP = {
  normal: { h1: "clamp(2rem, 5vw, 3.5rem)", h2: "clamp(1.5rem, 3.5vw, 2.5rem)", h3: "clamp(1.25rem, 2.5vw, 1.75rem)" },
  large:  { h1: "clamp(2.5rem, 5.5vw, 4.5rem)", h2: "clamp(1.75rem, 4vw, 3.25rem)", h3: "clamp(1.25rem, 2.5vw, 2rem)" },
  xl:     { h1: "clamp(3rem, 8vw, 7rem)", h2: "clamp(2rem, 5.5vw, 5rem)", h3: "clamp(1.5rem, 3vw, 2.5rem)" },
};

export function themeToCSS(theme: Theme): string {
  const scale = SCALE_MAP[theme.typography.heading_scale ?? "normal"];
  return `:root {
  --color-primary: ${theme.colors.primary};
  --color-primary-fg: ${theme.colors.primary_foreground};
  --color-secondary: ${theme.colors.secondary};
  --color-secondary-fg: ${theme.colors.secondary_foreground};
  --color-bg: ${theme.colors.background};
  --color-fg: ${theme.colors.foreground};
  --color-muted: ${theme.colors.muted};
  --color-muted-fg: ${theme.colors.muted_foreground};
  --color-accent: ${theme.colors.accent};
  --color-border: ${theme.colors.border};
  --color-surface: ${theme.colors.surface};
  --font-heading: '${theme.typography.heading_font}', system-ui, sans-serif;
  --font-body: '${theme.typography.body_font}', system-ui, sans-serif;
  --font-heading-weight: ${theme.typography.heading_weight};
  --heading-transform: ${theme.typography.heading_transform};
  --heading-tracking: ${theme.typography.heading_tracking === "tight" ? "-0.025em" : theme.typography.heading_tracking === "wide" ? "0.05em" : "0"};
  --radius: ${RADIUS_MAP[theme.shape.radius]};
  --section-padding: ${PADDING_MAP[theme.spacing.section_padding]};
  --h1-size: ${scale.h1};
  --h2-size: ${scale.h2};
  --h3-size: ${scale.h3};
}`;
}

export function googleFontsUrl(theme: Theme): string {
  const fonts = new Set([theme.typography.heading_font, theme.typography.body_font]);
  const families = [...fonts]
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;600;700;800;900`)
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
