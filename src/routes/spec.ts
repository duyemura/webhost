import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { DEFAULT_THEME } from "../blocks/types.js";
import { specSchema, themeSchema } from "./schemas.js";

export const specRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/sites/:id/spec", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select(["id", "spec", "theme"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();
    if (!site.spec) return reply.notFound("No spec set for this site.");

    return { spec: site.spec, theme: site.theme ?? DEFAULT_THEME };
  });

  app.put("/api/sites/:id/spec", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const parsed = specSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.badRequest(`Invalid spec: ${parsed.error.issues.map(i => i.message).join("; ")}`);
    }

    const now = new Date();
    const updated = await db
      .updateTable("sites")
      .set({ spec: JSON.stringify(parsed.data), updated_at: now, draft_updated_at: now })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });

  app.put("/api/sites/:id/theme", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const parsed = themeSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.badRequest(`Invalid theme: ${parsed.error.issues.map(i => i.message).join("; ")}`);
    }

    const now = new Date();
    const updated = await db
      .updateTable("sites")
      .set({ theme: JSON.stringify(parsed.data), updated_at: now, draft_updated_at: now })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });
};
