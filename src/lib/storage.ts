import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";
import { putFile, getFile, deleteFile } from "./r2.js";

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

export interface ReadAssetResult {
  body: unknown;
  cacheControl: string;
}

export async function readAsset(siteId: string, filename: string): Promise<ReadAssetResult | null> {
  if (useR2) {
    const body = await getFile(`assets/${siteId}/${filename}`);
    if (!body) return null;
    return { body, cacheControl: "public, max-age=31536000, immutable" };
  }
  const filePath = localPath(siteId, filename);
  if (!fs.existsSync(filePath)) return null;
  return { body: fs.createReadStream(filePath), cacheControl: "public, max-age=3600" };
}

export async function removeAsset(siteId: string, filename: string): Promise<void> {
  if (useR2) {
    await deleteFile(`assets/${siteId}/${filename}`);
  } else {
    try {
      fs.unlinkSync(localPath(siteId, filename));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
}

export function assetUrl(siteId: string, filename: string): string {
  return `/api/sites/${siteId}/assets/${filename}`;
}

