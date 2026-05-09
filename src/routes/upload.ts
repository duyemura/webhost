import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import AdmZip from "adm-zip";
import { db } from "../db/client.js";
import { putFile, deleteFile, listFiles } from "../lib/r2.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
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
  ".txt": "text/plain",
  ".xml": "application/xml",
};

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

const BLOCKED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const BLOCKED_PREFIXES = ["__MACOSX/", ".git/"];

function isSafeEntryPath(entryPath: string): boolean {
  if (path.isAbsolute(entryPath)) return false;
  const normalized = path.normalize(entryPath);
  if (normalized.startsWith("..")) return false;
  const basename = path.basename(normalized);
  if (BLOCKED_NAMES.has(basename)) return false;
  if (basename.startsWith(".") && basename !== ".well-known") return false;
  if (BLOCKED_PREFIXES.some((p) => entryPath.startsWith(p))) return false;
  return true;
}

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  // Upload a zip — extracts all files into R2
  app.post("/api/sites/:id/upload", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select(["id", "published_at"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const data = await req.file();
    if (!data) return reply.badRequest("No file attached.");

    const filename = data.filename.toLowerCase();
    if (!filename.endsWith(".zip")) {
      return reply.badRequest("Only .zip files are accepted.");
    }

    const buffer = await data.toBuffer();

    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch {
      return reply.badRequest("The uploaded file is not a valid zip archive.");
    }

    const entries = zip.getEntries();
    let extracted = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const entryPath = entry.entryName;
      if (!isSafeEntryPath(entryPath)) continue;

      const normalizedPath = path.normalize(entryPath);
      if (normalizedPath.startsWith("..")) continue;

      const key = `sites/${id}/${normalizedPath}`;
      await putFile(key, entry.getData(), contentTypeFor(normalizedPath));
      extracted++;
    }

    if (extracted === 0) {
      return reply.badRequest("The zip contained no usable files.");
    }

    if (!site.published_at) {
      await db
        .updateTable("sites")
        .set({ published_at: new Date(), updated_at: new Date() })
        .where("id", "=", id)
        .execute();
    } else {
      await db
        .updateTable("sites")
        .set({ updated_at: new Date() })
        .where("id", "=", id)
        .execute();
    }

    const updatedSite = await db
      .selectFrom("sites")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

    return reply.status(200).send({ filesExtracted: extracted, site: updatedSite });
  });

  // Upload a single file into the site
  app.post("/api/sites/:id/files", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const data = await req.file();
    if (!data) return reply.badRequest("No file attached.");

    if (!isSafeEntryPath(data.filename)) {
      return reply.badRequest("Invalid filename.");
    }

    const buffer = await data.toBuffer();
    const key = `sites/${id}/${data.filename}`;
    await putFile(key, buffer, contentTypeFor(data.filename));

    await db
      .updateTable("sites")
      .set({ updated_at: new Date() })
      .where("id", "=", id)
      .execute();

    return reply.status(201).send({ path: data.filename, size: buffer.length });
  });

  // Delete a specific file from the site
  app.delete("/api/sites/:id/files", async (req, reply) => {
    const { id } = req.params as { id: string };
    const { filePath } = req.query as { filePath?: string };

    if (!filePath) return reply.badRequest("filePath query parameter is required.");

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    if (!isSafeEntryPath(filePath)) {
      return reply.badRequest("Invalid file path.");
    }

    await deleteFile(`sites/${id}/${path.normalize(filePath)}`);
    return reply.status(204).send();
  });

  // List files in a site
  app.get("/api/sites/:id/files", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const objects = await listFiles(`sites/${id}/`);
    const prefix = `sites/${id}/`;
    const files = objects.map((o) => ({
      path: o.key.slice(prefix.length),
      size: o.size,
    }));

    return { files };
  });
};
