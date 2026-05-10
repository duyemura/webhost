import type { BusinessProfile } from "../db/types.js";

export function interpolate(text: string, profile: BusinessProfile | null): string {
  if (!profile) return text;
  const name = profile.biz_name ?? "";
  const phone = profile.phone ?? "";
  const email = profile.email ?? "";
  const city = profile.city ?? "";
  const state = profile.state ?? "";
  const address = profile.address ?? "";
  const hours = profile.hours ?? "";
  const description = profile.description ?? "";

  return text
    // Canonical tokens
    .replace(/\{\{business\.name\}\}/g, name)
    .replace(/\{\{business\.city\}\}/g, city)
    .replace(/\{\{business\.state\}\}/g, state)
    .replace(/\{\{business\.phone\}\}/g, phone)
    .replace(/\{\{business\.email\}\}/g, email)
    .replace(/\{\{business\.address\}\}/g, address)
    .replace(/\{\{business\.hours\}\}/g, hours)
    .replace(/\{\{business\.description\}\}/g, description)
    // Common AI-generated aliases
    .replace(/\{\{gym_name\}\}/g, name)
    .replace(/\{\{biz_name\}\}/g, name)
    .replace(/\{\{company_name\}\}/g, name)
    .replace(/\{\{business_name\}\}/g, name)
    .replace(/\{\{business_phone\}\}/g, phone)
    .replace(/\{\{gym_phone\}\}/g, phone)
    .replace(/\{\{phone_number\}\}/g, phone)
    .replace(/\{\{business_email\}\}/g, email)
    .replace(/\{\{gym_email\}\}/g, email)
    .replace(/\{\{location\}\}/g, [city, state].filter(Boolean).join(", "))
    .replace(/\{\{city\}\}/g, city)
    .replace(/\{\{state\}\}/g, state);
}
