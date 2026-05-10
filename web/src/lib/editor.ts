export type FieldInputType = "text" | "textarea" | "url" | "switch" | "cta" | "string-array" | "item-list" | "json";

const TEXTAREA_KEYS = new Set(["body", "description", "html", "quote", "answer", "bio", "details", "subheadline", "headline"]);
const TEXT_KEYS = new Set(["title", "name", "label", "period", "price", "value", "tag", "role", "author", "platform", "date", "icon"]);
const MEDIA_URL_KEYS = new Set(["image_url", "photo_url", "background_video_url", "video_url", "logo_url", "thumbnail_url"]);

// Lower number = appears earlier in the form
const FIELD_PRIORITY: Record<string, number> = {
  // Identity / headline content
  eyebrow: 10,
  headline: 20,
  title: 25,
  accent_words: 30,
  subheadline: 40,
  // Body content
  body: 50,
  description: 55,
  quote: 57,
  bio: 58,
  answer: 59,
  details: 60,
  html: 65,
  // Meta / attribution
  name: 70,
  author: 72,
  role: 74,
  date: 76,
  platform: 78,
  // Pricing
  price: 80,
  period: 82,
  // Tags / badges
  tag: 85,
  icon: 87,
  // CTAs
  cta_primary: 90,
  cta_secondary: 95,
  url: 97,
  // Media
  image_url: 100,
  photo_url: 101,
  logo_url: 102,
  thumbnail_url: 103,
  background_video_url: 105,
  video_url: 106,
  // Style / background
  background: 110,
  // Toggles
  show_eyebrow: 120,
  // Collections (always last)
  stats_bar: 200,
  items: 210,
};

function fieldPriority(key: string): number {
  if (key in FIELD_PRIORITY) return FIELD_PRIORITY[key];
  if (key.startsWith("show_")) return 150;
  if (key.endsWith("_url")) return 108;
  if (key.endsWith("_image_url")) return 103;
  if (key.endsWith("_video_url")) return 106;
  return 180;
}

export function sortFields(keys: string[]): string[] {
  return [...keys].sort((a, b) => fieldPriority(a) - fieldPriority(b));
}

export function isMediaUrlKey(key: string): boolean {
  return MEDIA_URL_KEYS.has(key) || key.endsWith("_image_url") || key.endsWith("_video_url");
}

function isCtaObject(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("text" in value || "url" in value)
  );
}

export function inferFieldType(key: string, value: unknown): FieldInputType {
  if (typeof value === "boolean" || key.startsWith("show_")) return "switch";
  if (key === "url" || key.endsWith("_url")) return "url";
  if (TEXTAREA_KEYS.has(key)) return "textarea";
  if (TEXT_KEYS.has(key)) return "text";
  if (typeof value === "string") return "text";
  if (isCtaObject(value)) return "cta";
  if (Array.isArray(value)) {
    if (value.length === 0 || typeof value[0] === "string") return "string-array";
    if (typeof value[0] === "object" && value[0] !== null) return "item-list";
  }
  return "json";
}

export function colorToHex(color: string): string {
  const trimmed = color.trim();

  // Short hex: #abc → #aabbcc
  const shortHex = trimmed.match(/^#([0-9a-fA-F]{3})$/);
  if (shortHex) {
    const [r, g, b] = shortHex[1].split("").map((c) => c + c);
    return `#${r}${g}${b}`;
  }

  // Full hex: #rrggbb or #rrggbbaa
  if (/^#[0-9a-fA-F]{6,8}$/.test(trimmed)) {
    return trimmed.slice(0, 7).toLowerCase();
  }

  // rgb() / rgba()
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    return toHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3]));
  }

  // hsl() / hsla()
  const hsl = trimmed.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
  if (hsl) {
    const [r, g, b] = hslToRgb(Number(hsl[1]), Number(hsl[2]) / 100, Number(hsl[3]) / 100);
    return toHex(r, g, b);
  }

  return "#000000";
}

function toHex(r: number, g: number, b: number): string {
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }

  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
