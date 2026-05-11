import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { db } from "../db/client.js";
import type { AllowedMimeType } from "../db/types.js";
import { storeAsset, removeAsset, readAsset } from "../lib/storage.js";

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "image/x-icon", "image/vnd.microsoft.icon",
  "video/mp4", "video/webm",
]);
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export const assetsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { fileSize: MAX_BYTES },
    throwFileSizeLimit: true,
  });

  // Public — no auth, needed for <img> tags in site HTML
  app.get("/api/sites/:siteId/assets/:filename", { onRequest: [] as [] }, async (req, reply) => {
    const { siteId, filename } = req.params as { siteId: string; filename: string };

    if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(filename)) return reply.notFound();

    const asset = await db
      .selectFrom("assets")
      .select(["mime_type", "filename"])
      .where("site_id", "=", siteId)
      .where("filename", "=", filename)
      .executeTakeFirst();

    if (!asset) return reply.notFound();

    const result = await readAsset(siteId, filename);
    if (!result) return reply.notFound();

    reply.header("Content-Type", asset.mime_type);
    reply.header("Cache-Control", result.cacheControl);
    reply.header("X-Content-Type-Options", "nosniff");
    return reply.send(result.body);
  });

  // Auth-required routes below
  app.addHook("onRequest", app.authenticate);

  app.get("/api/sites/:id/assets", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const assets = await db
      .selectFrom("assets")
      .selectAll()
      .where("site_id", "=", id)
      .orderBy("created_at", "desc")
      .execute();

    return assets.map(a => ({ ...a, url: `/api/sites/${id}/assets/${a.filename}` }));
  });

  app.post("/api/sites/:id/assets", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const data = await req.file();
    if (!data) return reply.badRequest("No file uploaded.");

    const mime = data.mimetype;
    if (!ALLOWED_MIME.has(mime)) {
      return reply.badRequest("File type not allowed. Supported: JPEG, PNG, WebP, GIF, ICO, MP4, WebM.");
    }

    const ext = mime.split("/")[1]!.replace("jpeg", "jpg").replace("x-icon", "ico").replace("vnd.microsoft.icon", "ico");
    const filename = `${crypto.randomUUID()}.${ext}`;
    const buffer = await data.toBuffer();

    const url = await storeAsset(id, filename, buffer, mime);

    const asset = await db
      .insertInto("assets")
      .values({
        site_id: id,
        filename,
        original_name: data.filename ?? filename,
        mime_type: mime as AllowedMimeType,
        size: buffer.byteLength,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ...asset, url };
  });

  app.delete("/api/sites/:id/assets/:assetId", async (req, reply) => {
    const { id, assetId } = req.params as { id: string; assetId: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const asset = await db
      .selectFrom("assets")
      .select(["id", "filename"])
      .where("id", "=", assetId)
      .where("site_id", "=", id)
      .executeTakeFirst();

    if (!asset) return reply.notFound();

    // Delete DB row first — if storage removal fails, the file is orphaned but not accessible
    await db.deleteFrom("assets").where("id", "=", assetId).execute();
    try {
      await removeAsset(id, asset.filename);
    } catch (err) {
      req.log.error({ err, siteId: id, assetId, filename: asset.filename }, "asset file removal failed after DB delete");
    }

    return reply.status(204).send();
  });
};
