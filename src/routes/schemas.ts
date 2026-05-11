import { z } from "zod";

// CSS color: hex 3/4/6/8, rgb(), rgba(), hsl(), hsla(), or a named keyword (no quotes/semicolons)
export const cssColor = z
  .string()
  .regex(
    /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*[\d.%,\s]+\)|hsla?\(\s*[\d.%,\s]+\)|[a-zA-Z]+)$/,
    "Must be a valid CSS color (hex, rgb, hsl, or color keyword)"
  );

// Font family name: letters, digits, spaces — no CSS injection characters
export const fontName = z
  .string()
  .regex(/^[A-Za-z0-9 ]+$/, "Font name must contain only letters, digits, and spaces")
  .max(80);

export const themeSchema = z.object({
  colors: z.object({
    primary: cssColor,
    primary_foreground: cssColor,
    secondary: cssColor,
    secondary_foreground: cssColor,
    background: cssColor,
    foreground: cssColor,
    muted: cssColor,
    muted_foreground: cssColor,
    accent: cssColor,
    border: cssColor,
    surface: cssColor,
  }),
  typography: z.object({
    heading_font: fontName,
    body_font: fontName,
    heading_weight: z.enum(["400", "500", "600", "700", "800", "900"]),
    heading_transform: z.enum(["none", "uppercase", "lowercase", "capitalize"]),
    heading_tracking: z.enum(["tight", "normal", "wide"]),
  }),
  shape: z.object({ radius: z.enum(["none", "sm", "md", "lg", "full"]) }),
  spacing: z.object({ section_padding: z.enum(["compact", "normal", "loose"]) }),
  style_hint: z.string().max(200),
});

export const sectionSchema = z.object({
  id: z.string(),
  type: z.string(),
}).passthrough();

export const specSchema = z.object({
  version: z.literal(1),
  pages: z.array(z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(200),
    nav_label: z.string().min(1).max(40).optional(),
    meta_description: z.string().max(300).optional().default(""),
    sections: z.array(sectionSchema),
  })).min(1),
}).refine(s => s.pages[0]?.slug === "index", { message: "First page slug must be \"index\"" });
