import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import fs from "node:fs/promises";
import AdmZip from "adm-zip";
import { db } from "../db/client.js";
import { config } from "../config.js";

const BLOCKED_NAMES = new Set([".DS_Store", "Thumbs.db", "desktop.ini"]);
const BLOCKED_PREFIXES = ["__MACOSX/", ".git/"];

function isSafeEntryPath(entryPath: string): boolean {
  // Reject absolute paths and traversal attempts
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

  // Upload a zip — extracts all files into the site directory
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

    const siteDir = path.join(config.sitesDir, id);
    await fs.mkdir(siteDir, { recursive: true });

    const entries = zip.getEntries();
    let extracted = 0;

    for (const entry of entries) {
      if (entry.isDirectory) continue;

      const entryPath = entry.entryName;
      if (!isSafeEntryPath(entryPath)) continue;

      const destPath = path.join(siteDir, path.normalize(entryPath));

      // Ensure destination is still inside siteDir after normalization
      if (!destPath.startsWith(siteDir + path.sep) && destPath !== siteDir) {
        continue;
      }

      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, entry.getData());
      extracted++;
    }

    if (extracted === 0) {
      return reply.badRequest("The zip contained no usable files.");
    }

    // Mark as published on first upload
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

    const siteDir = path.join(config.sitesDir, id);
    const destPath = path.join(siteDir, data.filename);

    if (!destPath.startsWith(siteDir + path.sep)) {
      return reply.badRequest("Invalid file path.");
    }

    await fs.mkdir(path.dirname(destPath), { recursive: true });
    const buffer = await data.toBuffer();
    await fs.writeFile(destPath, buffer);

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

    const siteDir = path.join(config.sitesDir, id);
    const targetPath = path.join(siteDir, path.normalize(filePath));

    if (!targetPath.startsWith(siteDir + path.sep)) {
      return reply.badRequest("Invalid file path.");
    }

    try {
      await fs.unlink(targetPath);
    } catch (err: any) {
      if (err.code === "ENOENT") return reply.notFound();
      throw err;
    }

    return reply.status(204).send();
  });
};
