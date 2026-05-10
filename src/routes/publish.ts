import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { copyPrefix, deletePrefix } from "../lib/r2.js";

export const publishRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.post("/api/sites/:id/publish", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select(["id", "published_at"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();
    if (!site.published_at) return reply.badRequest("Upload files before publishing.");

    await copyPrefix(`sites/${id}/`, `live/${id}/`);

    const updated = await db
      .updateTable("sites")
      .set({ live_published_at: new Date(), updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ...updated };
  });

  app.delete("/api/sites/:id/publish", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    await deletePrefix(`live/${id}/`);

    const updated = await db
      .updateTable("sites")
      .set({ live_published_at: null, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ...updated };
  });
};
