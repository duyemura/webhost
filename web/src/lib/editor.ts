export type FieldInputType = "text" | "textarea" | "url" | "switch" | "json";

const TEXTAREA_KEYS = new Set(["body", "description", "html", "quote", "answer", "bio", "details", "subheadline"]);
const TEXT_KEYS = new Set(["headline", "title", "name", "label", "period", "price", "value", "tag", "role", "author", "platform", "date", "icon"]);

export function inferFieldType(key: string, value: unknown): FieldInputType {
  if (typeof value === "boolean" || key.startsWith("show_")) return "switch";
  if (key === "url" || key.endsWith("_url")) return "url";
  if (TEXTAREA_KEYS.has(key)) return "textarea";
  if (TEXT_KEYS.has(key)) return "text";
  if (typeof value === "string") return "text";
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
