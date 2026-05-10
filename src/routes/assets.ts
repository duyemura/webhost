import fs from "node:fs";
import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { db } from "../db/client.js";
import { storeAsset, removeAsset, getLocalAssetPath, useR2 } from "../lib/storage.js";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config.js";

const ALLOWED_MIME = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml",
  "video/mp4", "video/webm",
]);
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

const r2 = useR2 ? new S3Client({
  region: "auto",
  endpoint: `https://${config.cloudflare.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.cloudflare.r2AccessKeyId,
    secretAccessKey: config.cloudflare.r2SecretKey,
  },
}) : null;

export const assetsRoutes: FastifyPluginAsync = async (app) => {
  await app.register(multipart, { limits: { fileSize: MAX_BYTES } });

  // Public — serve asset file (no auth, needed for <img> tags in site HTML)
  app.get("/api/sites/:siteId/assets/:filename", async (req, reply) => {
    const { siteId, filename } = req.params as { siteId: string; filename: string };

    // Validate filename to prevent path traversal
    if (!/^[a-zA-Z0-9_-]+\.[a-z0-9]+$/.test(filename)) {
      return reply.notFound();
    }

    const asset = await db
      .selectFrom("assets")
      .select(["mime_type", "filename"])
      .where("site_id", "=", siteId)
      .where("filename", "=", filename)
      .executeTakeFirst();

    if (!asset) return reply.notFound();

    if (useR2 && r2) {
      const obj = await r2.send(new GetObjectCommand({
        Bucket: config.cloudflare.r2Bucket,
        Key: `assets/${siteId}/${filename}`,
      }));
      reply.header("Content-Type", asset.mime_type);
      reply.header("Cache-Control", "public, max-age=31536000, immutable");
      return reply.send(obj.Body);
    } else {
      const filePath = getLocalAssetPath(siteId, filename);
      if (!fs.existsSync(filePath)) return reply.notFound();
      reply.header("Content-Type", asset.mime_type);
      reply.header("Cache-Control", "public, max-age=3600");
      return reply.send(fs.createReadStream(filePath));
    }
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

    return assets.map(a => ({
      ...a,
      url: `/api/sites/${id}/assets/${a.filename}`,
    }));
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
      return reply.badRequest(`File type not allowed. Supported: JPEG, PNG, WebP, GIF, SVG, MP4, WebM.`);
    }

    const ext = mime.split("/")[1]!.replace("jpeg", "jpg").replace("svg+xml", "svg");
    const filename = `${crypto.randomUUID()}.${ext}`;

    const buffer = await data.toBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return reply.badRequest("File too large. Maximum size is 50 MB.");
    }

    const url = await storeAsset(id, filename, buffer, mime);

    const asset = await db
      .insertInto("assets")
      .values({
        site_id: id,
        filename,
        original_name: data.filename ?? filename,
        mime_type: mime,
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

    await removeAsset(id, asset.filename);
    await db.deleteFrom("assets").where("id", "=", assetId).execute();

    return reply.status(204).send();
  });
};
