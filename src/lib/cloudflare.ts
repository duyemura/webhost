import { config } from "../config.js";

const BASE = "https://api.cloudflare.com/client/v4";
const { zoneId, apiToken } = config.cloudflare;

async function cfFetch(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${apiToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const data = await res.json() as { success: boolean; errors: { message: string }[]; result: any };
  if (!data.success) {
    throw new Error(data.errors[0]?.message ?? "Cloudflare API error");
  }
  return data.result;
}

export async function provisionHostname(
  hostname: string
): Promise<{ id: string; status: string }> {
  const result = await cfFetch(`/zones/${zoneId}/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
    }),
  });
  return { id: result.id, status: result.status };
}

export async function deprovisionHostname(hostnameId: string): Promise<void> {
  await cfFetch(`/zones/${zoneId}/custom_hostnames/${hostnameId}`, { method: "DELETE" });
}

export async function getHostnameStatus(
  hostnameId: string
): Promise<{ status: string; ssl_status: string }> {
  const result = await cfFetch(`/zones/${zoneId}/custom_hostnames/${hostnameId}`);
  return {
    status: result.status,
    ssl_status: result.ssl?.status ?? "unknown",
  };
}
