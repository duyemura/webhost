import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";

const upsertSchema = z.object({
  biz_name: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  zip: z.string().max(20).nullable().optional(),
  country: z.string().max(10).optional(),
  website_url: z.string().max(500).nullable().optional(),
  hours: z.string().max(500).nullable().optional(),
});

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  async function getSiteOrThrow(siteId: string, userId: string) {
    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", siteId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return site ?? null;
  }

  app.get("/api/sites/:id/profile", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await getSiteOrThrow(id, req.user.sub))) return reply.notFound();

    const profile = await db
      .selectFrom("business_profiles")
      .selectAll()
      .where("site_id", "=", id)
      .executeTakeFirst();

    return profile ?? {};
  });

  app.put("/api/sites/:id/profile", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await getSiteOrThrow(id, req.user.sub))) return reply.notFound();

    const body = upsertSchema.safeParse(req.body);
    if (!body.success) return reply.badRequest(body.error.issues[0]?.message);

    const existing = await db
      .selectFrom("business_profiles")
      .select("id")
      .where("site_id", "=", id)
      .executeTakeFirst();

    if (existing) {
      const updated = await db
        .updateTable("business_profiles")
        .set({ ...body.data, updated_at: new Date() })
        .where("site_id", "=", id)
        .returningAll()
        .executeTakeFirstOrThrow();
      return updated;
    }

    const created = await db
      .insertInto("business_profiles")
      .values({ site_id: id, ...body.data })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.status(201).send(created);
  });
};
