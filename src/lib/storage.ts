import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { putFile, deletePrefix } from "./r2.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

const useR2 = !!(config.cloudflare.r2AccessKeyId && config.cloudflare.r2SecretKey);

function localPath(siteId: string, filename: string): string {
  return path.join(UPLOADS_DIR, siteId, filename);
}

export async function storeAsset(
  siteId: string,
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  if (useR2) {
    const key = `assets/${siteId}/${filename}`;
    await putFile(key, buffer, contentType);
  } else {
    const dir = path.join(UPLOADS_DIR, siteId);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localPath(siteId, filename), buffer);
  }
  return assetUrl(siteId, filename);
}

export async function removeAsset(siteId: string, filename: string): Promise<void> {
  if (useR2) {
    await deletePrefix(`assets/${siteId}/${filename}`);
  } else {
    try { fs.unlinkSync(localPath(siteId, filename)); } catch { /* already gone */ }
  }
}

export function assetUrl(siteId: string, filename: string): string {
  return `/api/sites/${siteId}/assets/${filename}`;
}

export function getLocalAssetPath(siteId: string, filename: string): string {
  return localPath(siteId, filename);
}

export { useR2 };
