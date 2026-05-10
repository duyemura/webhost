import type { BusinessProfile } from "../db/types.js";

export function interpolate(text: string, profile: BusinessProfile | null): string {
  if (!profile) return text;
  return text
    .replace(/\{\{business\.name\}\}/g, profile.biz_name ?? "")
    .replace(/\{\{business\.city\}\}/g, profile.city ?? "")
    .replace(/\{\{business\.state\}\}/g, profile.state ?? "")
    .replace(/\{\{business\.phone\}\}/g, profile.phone ?? "")
    .replace(/\{\{business\.email\}\}/g, profile.email ?? "")
    .replace(/\{\{business\.address\}\}/g, profile.address ?? "")
    .replace(/\{\{business\.hours\}\}/g, profile.hours ?? "")
    .replace(/\{\{business\.description\}\}/g, profile.description ?? "");
}
