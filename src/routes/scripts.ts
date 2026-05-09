import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { SCRIPT_REGISTRY } from "../scripts/index.js";

const validTypes = Object.keys(SCRIPT_REGISTRY);

const createSchema = z.object({
  type: z.string().refine((t) => validTypes.includes(t), {
    message: `Type must be one of: ${validTypes.join(", ")}`,
  }),
  label: z.string().min(1).max(100).optional(),
  tracking_id: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
});

const updateSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  tracking_id: z.string().min(1).nullable().optional(),
  code: z.string().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const scriptsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  // Shared: verify site belongs to the authenticated user
  async function getSiteOrThrow(siteId: string, userId: string) {
    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", siteId)
      .where("user_id", "=", userId)
      .executeTakeFirst();
    return site ?? null;
  }

  app.get("/api/sites/:id/scripts", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await getSiteOrThrow(id, req.user.sub))) return reply.notFound();

    const scripts = await db
      .selectFrom("scripts")
      .selectAll()
      .where("site_id", "=", id)
      .orderBy("created_at", "asc")
      .execute();

    return { scripts };
  });

  app.post("/api/sites/:id/scripts", async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await getSiteOrThrow(id, req.user.sub))) return reply.notFound();

    const body = createSchema.safeParse(req.body);
    if (!body.success) return reply.badRequest(body.error.issues[0]?.message);

    const { type, tracking_id, code } = body.data;
    const label = body.data.label ?? SCRIPT_REGISTRY[type]!.label;

    if (type !== "custom" && !tracking_id) {
      return reply.badRequest("tracking_id is required for this script type.");
    }
    if (type === "custom" && !code) {
      return reply.badRequest("code is required for custom script type.");
    }

    const script = await db
      .insertInto("scripts")
      .values({ site_id: id, type, label, tracking_id: tracking_id ?? null, code: code ?? null })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.status(201).send(script);
  });

  app.patch("/api/sites/:id/scripts/:scriptId", async (req, reply) => {
    const { id, scriptId } = req.params as { id: string; scriptId: string };
    if (!(await getSiteOrThrow(id, req.user.sub))) return reply.notFound();

    const body = updateSchema.safeParse(req.body);
    if (!body.success) return reply.badRequest(body.error.issues[0]?.message);

    const script = await db
      .selectFrom("scripts")
      .select("id")
      .where("id", "=", scriptId)
      .where("site_id", "=", id)
      .executeTakeFirst();
    if (!script) return reply.notFound();

    const updated = await db
      .updateTable("scripts")
      .set(body.data)
      .where("id", "=", scriptId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });

  app.delete("/api/sites/:id/scripts/:scriptId", async (req, reply) => {
    const { id, scriptId } = req.params as { id: string; scriptId: string };
    if (!(await getSiteOrThrow(id, req.user.sub))) return reply.notFound();

    const deleted = await db
      .deleteFrom("scripts")
      .where("id", "=", scriptId)
      .where("site_id", "=", id)
      .returning("id")
      .executeTakeFirst();
    if (!deleted) return reply.notFound();

    return reply.status(204).send();
  });
};
