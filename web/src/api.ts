export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export interface BrandKit {
  logo_url: string | null;
  favicon_url: string | null;
  primary: string;
  primary_foreground: string;
  secondary: string;
  background: string;
  foreground: string;
  accent: string;
  heading_font: string;
  body_font: string;
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  logo_url: null,
  favicon_url: null,
  primary: "#111827",
  primary_foreground: "#ffffff",
  secondary: "#374151",
  background: "#ffffff",
  foreground: "#111111",
  accent: "#111827",
  heading_font: "Inter",
  body_font: "Inter",
};

export interface Site {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  domain_status: string;
  cloudflare_hostname_id: string | null;
  cname_target: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  live_published_at: string | null;
  draft_updated_at: string | null;
  spec: unknown | null;
  theme: unknown | null;
  generation_prompt: string | null;
  theme_preset: string | null;
  published_theme: unknown | null;
  brand_kit: BrandKit | null;
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

function handleUnauthorized() {
  localStorage.removeItem("token");
  window.location.href = "/login";
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const token = getToken();
  const hasBody = init?.body != null;
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      message = JSON.parse(text)?.message ?? text;
    } catch {}
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const getMe = () => apiFetch<User>("/auth/me");

// Sites
export const getSites = () => apiFetch<Site[]>("/sites");
export const getSite = (id: string) => apiFetch<Site>(`/sites/${id}`);
export const createSite = (body: { name: string; slug?: string }) =>
  apiFetch<Site>("/sites", { method: "POST", body: JSON.stringify(body) });
export const updateSite = (id: string, body: { name?: string; custom_domain?: string | null }) =>
  apiFetch<Site>(`/sites/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteSite = (id: string) =>
  apiFetch<void>(`/sites/${id}`, { method: "DELETE" });
export const publishSite = (id: string) =>
  apiFetch<Site>(`/sites/${id}/publish`, { method: "POST", body: JSON.stringify({}) });
export const unpublishSite = (id: string) =>
  apiFetch<Site>(`/sites/${id}/publish`, { method: "DELETE" });

// Scripts
export interface SiteScript {
  id: string;
  site_id: string;
  type: string;
  label: string;
  tracking_id: string | null;
  code: string | null;
  enabled: boolean;
  created_at: string;
}

export interface AddScriptBody {
  type: string;
  label?: string;
  tracking_id?: string;
  code?: string;
}

export interface UpdateScriptBody {
  label?: string;
  tracking_id?: string | null;
  code?: string | null;
  enabled?: boolean;
}

export const getScripts = (siteId: string) =>
  apiFetch<{ scripts: SiteScript[] }>(`/sites/${siteId}/scripts`);
export const addScript = (siteId: string, body: AddScriptBody) =>
  apiFetch<SiteScript>(`/sites/${siteId}/scripts`, {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateScript = (siteId: string, scriptId: string, body: UpdateScriptBody) =>
  apiFetch<SiteScript>(`/sites/${siteId}/scripts/${scriptId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteScript = (siteId: string, scriptId: string) =>
  apiFetch<void>(`/sites/${siteId}/scripts/${scriptId}`, { method: "DELETE" });

export interface DomainStatus {
  status: string;
  ssl_status: string;
}

export const getDomainStatus = (siteId: string) =>
  apiFetch<DomainStatus>(`/sites/${siteId}/domain-status`);

export const THEME_PRESETS = ["bold", "professional", "warm", "dark", "minimal"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

export const THEME_PRESET_SWATCH: Record<ThemePreset, string> = {
  bold: "#111827",
  professional: "#111827",
  warm: "#111827",
  dark: "#111111",
  minimal: "#111827",
};

export const THEME_PRESET_LABELS: Record<ThemePreset, string> = {
  bold: "Bold",
  professional: "Professional",
  warm: "Warm",
  dark: "Dark",
  minimal: "Minimal",
};

export const THEME_PRESET_DESCRIPTIONS: Record<ThemePreset, string> = {
  bold: "Heavy condensed type, uppercase headings, punchy layout",
  professional: "Serif headings, refined spacing, polished feel",
  warm: "Rounded corners, soft type, approachable and friendly",
  dark: "Dark backgrounds, high contrast, premium modern feel",
  minimal: "Open sans-serif, generous whitespace, clean and airy",
};

export const generateSite = (siteId: string, body: { prompt: string; theme_preset?: string }) =>
  apiFetch<Site>(`/sites/${siteId}/generate`, { method: "POST", body: JSON.stringify(body) });

export interface ImportSummary {
  source_url: string;
  pages_scraped: number;
  sections_found: number;
  pages_generated: number;
  blocks_generated: number;
  gaps: string[];
}

export const importFromUrl = (siteId: string, body: { url: string; theme_preset?: string }) =>
  apiFetch<Site & { _import_summary: ImportSummary }>(`/sites/${siteId}/import-url`, { method: "POST", body: JSON.stringify(body) });

export interface BusinessProfile {
  id?: string;
  site_id?: string;
  biz_name?: string | null;
  description?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string;
  website_url?: string | null;
  hours?: string | null;
}

export const getProfile = (siteId: string) =>
  apiFetch<BusinessProfile>(`/sites/${siteId}/profile`);

export const saveProfile = (siteId: string, body: Omit<BusinessProfile, "id" | "site_id">) =>
  apiFetch<BusinessProfile>(`/sites/${siteId}/profile`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

// ── Block editor types ────────────────────────────────────────────────────────

export interface SiteSection { id: string; type: string; [key: string]: unknown }
export interface SitePage { slug: string; title: string; meta_description: string; sections: SiteSection[] }
export interface SiteSpec { version: 1; pages: SitePage[] }

export interface Theme {
  colors: {
    primary: string; primary_foreground: string; secondary: string; secondary_foreground: string;
    background: string; foreground: string; muted: string; muted_foreground: string;
    accent: string; border: string; surface: string;
  };
  typography: { heading_font: string; body_font: string; heading_weight: string; heading_transform: string; heading_tracking: string };
  shape: { radius: "none" | "sm" | "md" | "lg" | "full" };
  spacing: { section_padding: "compact" | "normal" | "loose" };
  style_hint: string;
}

export const DEFAULT_THEME: Theme = {
  colors: {
    primary: "#111827", primary_foreground: "#ffffff",
    secondary: "#374151", secondary_foreground: "#ffffff",
    background: "#ffffff", foreground: "#111111",
    muted: "#f9fafb", muted_foreground: "#6b7280",
    accent: "#111827", border: "#e5e7eb", surface: "#f9fafb",
  },
  typography: { heading_font: "Inter", body_font: "Inter", heading_weight: "700", heading_transform: "none", heading_tracking: "tight" },
  shape: { radius: "md" },
  spacing: { section_padding: "normal" },
  style_hint: "clean",
};

export const updateSpec = (id: string, spec: SiteSpec) =>
  apiFetch<Site>(`/sites/${id}/spec`, { method: "PUT", body: JSON.stringify(spec) });
export const updateTheme = (id: string, theme: Theme, themePreset?: string) =>
  apiFetch<Site>(`/sites/${id}/theme`, { method: "PUT", body: JSON.stringify({ theme, theme_preset: themePreset }) });
export const updateBrandKit = (id: string, brandKit: BrandKit) =>
  apiFetch<Site>(`/sites/${id}/brand-kit`, { method: "PUT", body: JSON.stringify(brandKit) });
export const revertThemeToPublished = (id: string) =>
  apiFetch<Site>(`/sites/${id}/theme/revert-to-published`, { method: "POST" });
export const getPresets = () =>
  apiFetch<Record<string, Theme>>("/presets");

export interface SiteTemplate {
  id: string;
  name: string;
  description: string;
  theme_preset: string;
  preview_image: string | null;
}

export interface SiteTemplateDetail extends SiteTemplate {
  blocks: SiteSection[];
}

export const getTemplates = () => apiFetch<SiteTemplate[]>("/templates");
export const getTemplate = (id: string) => apiFetch<SiteTemplateDetail>(`/templates/${id}`);

// ── Media assets ──────────────────────────────────────────────────────────────

export interface SiteAsset {
  id: string;
  site_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  created_at: string;
}

export const getAssets = (siteId: string) =>
  apiFetch<SiteAsset[]>(`/sites/${siteId}/assets`);

export async function uploadAsset(siteId: string, file: File): Promise<SiteAsset> {
  const token = localStorage.getItem("token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/sites/${siteId}/assets`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try { message = JSON.parse(text)?.message ?? text; } catch {}
    throw new Error(message);
  }
  return res.json();
}

export const deleteAsset = (siteId: string, assetId: string) =>
  apiFetch<void>(`/sites/${siteId}/assets/${assetId}`, { method: "DELETE" });

// ── Google Places ─────────────────────────────────────────────────────────────

export interface PlaceSearchResult {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  types: string[];
  rating: number | null;
  reviewCount: number | null;
  isFitness: boolean;
}

export interface PlaceReview {
  author: string;
  rating: number;
  text: string;
}

export interface PlaceDetail extends PlaceSearchResult {
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  hours: string | null;
  reviews: PlaceReview[];
}

export const searchPlaces = (q: string) =>
  apiFetch<PlaceSearchResult[]>(`/places/search?q=${encodeURIComponent(q)}`);

export const getPlaceDetail = (id: string) =>
  apiFetch<PlaceDetail>(`/places/${encodeURIComponent(id)}`);

// ── AI analytics & quality signals ───────────────────────────────────────────

export type QualityAction = "accepted" | "rebuilt" | "rated" | "section_edited" | "section_deleted" | "section_added";

export interface QualitySignalBody {
  cost_event_id?: string | null;
  page_slug?: string | null;
  action: QualityAction;
  rating?: number | null;
  metadata?: Record<string, unknown>;
}

export const postQualitySignal = (siteId: string, body: QualitySignalBody) =>
  apiFetch<{ id: string }>(`/sites/${siteId}/quality-signal`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export interface AiCallSummary {
  id: string;
  operation: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  duration_ms: number | null;
  created_at: string;
}

export const getSiteAiCalls = (siteId: string) =>
  apiFetch<AiCallSummary[]>(`/sites/${siteId}/ai-calls`);

// ── Utilities ─────────────────────────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

