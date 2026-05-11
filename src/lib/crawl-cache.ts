import crypto from "node:crypto";
import { db } from "../db/client.js";
import type { ScrapeResult } from "./scrape.js";

const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function hashUrl(url: string): string {
  const normalized = url.toLowerCase().replace(/\/+$/, "");
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export async function getCachedCrawl(url: string): Promise<ScrapeResult | null> {
  try {
    const row = await db
      .selectFrom("crawl_cache")
      .select("data")
      .where("url_hash", "=", hashUrl(url))
      .where("expires_at", ">", new Date())
      .executeTakeFirst();
    return row ? (row.data as ScrapeResult) : null;
  } catch {
    return null;
  }
}

export async function setCachedCrawl(url: string, data: ScrapeResult): Promise<void> {
  const hash = hashUrl(url);
  const expiresAt = new Date(Date.now() + TTL_MS);
  try {
    const existing = await db
      .selectFrom("crawl_cache")
      .select("id")
      .where("url_hash", "=", hash)
      .executeTakeFirst();

    if (existing) {
      await db
        .updateTable("crawl_cache")
        .set({ data: JSON.stringify(data), expires_at: expiresAt, created_at: new Date() })
        .where("url_hash", "=", hash)
        .execute();
    } else {
      await db
        .insertInto("crawl_cache")
        .values({ url_hash: hash, url, data: JSON.stringify(data), expires_at: expiresAt })
        .execute();
    }
  } catch (err) {
    console.warn({ err }, "crawl-cache: write failed — non-fatal");
  }
}
