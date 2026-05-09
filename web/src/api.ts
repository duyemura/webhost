export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

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
}

export interface SiteFile {
  path: string;
  size: number;
}

export interface UploadResult {
  filesExtracted: number;
  site: Site;
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
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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

// Separate helper for multipart uploads (no Content-Type header — browser sets it)
export async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
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

// Files
export const getSiteFiles = (id: string) =>
  apiFetch<{ files: SiteFile[] }>(`/sites/${id}/files`);
export const uploadZip = (id: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return apiUpload<UploadResult>(`/sites/${id}/upload`, form);
};
export const deleteFile = (siteId: string, filePath: string) =>
  apiFetch<void>(
    `/sites/${siteId}/files?filePath=${encodeURIComponent(filePath)}`,
    { method: "DELETE" }
  );

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

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
