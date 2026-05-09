import type { Script } from "../db/types.js";
import { gtm } from "./gtm.js";
import { ga4 } from "./ga4.js";
import { metaPixel } from "./meta_pixel.js";
import { pushpress } from "./pushpress.js";
import { custom } from "./custom.js";

export type ScriptDefinition = {
  label: string;
  headSnippet: (trackingId: string) => string;
  bodySnippet?: (trackingId: string) => string;
};

export const SCRIPT_REGISTRY: Record<string, ScriptDefinition> = {
  gtm,
  ga4,
  meta_pixel: metaPixel,
  pushpress,
  custom,
};

export function buildHeadSnippets(scripts: Script[]): string {
  return scripts
    .filter((s) => s.enabled)
    .map((s) => {
      const def = SCRIPT_REGISTRY[s.type];
      if (!def) return "";
      const id = s.type === "custom" ? (s.code ?? "") : (s.tracking_id ?? "");
      if (!id) return "";
      return def.headSnippet(id);
    })
    .filter(Boolean)
    .join("\n");
}

export function buildBodySnippets(scripts: Script[]): string {
  return scripts
    .filter((s) => s.enabled)
    .map((s) => {
      const def = SCRIPT_REGISTRY[s.type];
      if (!def?.bodySnippet) return "";
      const id = s.tracking_id ?? "";
      if (!id) return "";
      return def.bodySnippet(id);
    })
    .filter(Boolean)
    .join("\n");
}
