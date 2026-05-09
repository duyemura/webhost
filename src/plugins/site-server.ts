import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import path from "node:path";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { getFile } from "../lib/r2.js";
import { buildHeadSnippets, buildBodySnippets } from "../scripts/index.js";
import type { Script } from "../db/types.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
};

const RESERVED_SLUGS = new Set(["app", "www", "api", "mail", "admin", "status"]);

function getSiteSlug(host: string, baseDomain: string): string | null {
  const hostname = host.split(":")[0];
  const suffix = `.${baseDomain}`;
  if (hostname.endsWith(suffix)) {
    const slug = hostname.slice(0, -suffix.length);
    if (slug && !slug.includes(".")) return slug;
  }
  return null;
}

async function serveFile(
  r2Key: string,
  reply: any,
  scripts?: Script[]
): Promise<boolean> {
  const file = await getFile(r2Key);
  if (!file) return false;

  const ext = path.extname(r2Key).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? file.contentType;

  if (ext === ".html" && scripts?.length) {
    let html = file.body.toString("utf-8");
    const head = buildHeadSnippets(scripts);
    const body = buildBodySnippets(scripts);
    if (head) html = html.replace("</head>", `${head}\n</head>`);
    if (body) html = html.replace("</body>", `${body}\n</body>`);
    reply.header("Content-Type", contentType).send(html);
  } else {
    reply.header("Content-Type", contentType).send(file.body);
  }
  return true;
}

async function serveSite(
  siteId: string,
  requestUrl: string,
  reply: any
): Promise<void> {
  const scripts = await db
    .selectFrom("scripts")
    .selectAll()
    .where("site_id", "=", siteId)
    .where("enabled", "=", true)
    .orderBy("created_at", "asc")
    .execute();

  const requestPath = requestUrl.split("?")[0];
  const decodedPath = decodeURIComponent(requestPath);
  const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "").replace(/^\//, "");
  const base = `sites/${siteId}`;

  const candidates = [
    `${base}/${safePath}`,
    `${base}/${safePath}/index.html`,
    `${base}/index.html`,
  ];

  for (const key of candidates) {
    if (await serveFile(key, reply, scripts)) return;
  }

  reply.header("Content-Type", "text/html; charset=utf-8");
  reply.status(404).send(NOT_FOUND_HTML);
}

const NOT_FOUND_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="UTF-8"><title>Site not found</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}
.box{text-align:center;color:#374151}.box h1{font-size:1.5rem;font-weight:600;margin-bottom:.5rem}
.box p{color:#6b7280;font-size:.875rem}</style></head>
<body><div class="box"><h1>Site not found</h1><p>This site hasn't been set up yet, or the address is incorrect.</p></div></body>
</html>`;

const siteServerPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (req, reply) => {
    const hostname = req.hostname;

    // Path 1: subdomain match — {slug}.localhost (or configured baseDomain)
    const slug = getSiteSlug(hostname, config.baseDomain);
    if (slug && !RESERVED_SLUGS.has(slug)) {
      const site = await db
        .selectFrom("sites")
        .select(["id", "published_at"])
        .where("slug", "=", slug)
        .executeTakeFirst();

      if (!site || !site.published_at) {
        reply.header("Content-Type", "text/html; charset=utf-8");
        reply.status(404).send(NOT_FOUND_HTML);
        return;
      }

      await serveSite(site.id, req.url, reply);
      return;
    }

    // Path 2: custom domain match — owner-provided domain points here
    const site = await db
      .selectFrom("sites")
      .select(["id", "published_at"])
      .where("custom_domain", "=", hostname)
      .executeTakeFirst();

    if (!site || !site.published_at) return; // not a known site — fall through to API/dashboard

    await serveSite(site.id, req.url, reply);
  });
};

// fp() breaks plugin encapsulation so the onRequest hook runs for ALL requests
export const siteServer = fp(siteServerPlugin);
