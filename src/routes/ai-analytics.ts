import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { registry } from "../blocks/index.js";
import { config } from "../config.js";

const signalBodySchema = z.object({
  ai_call_id: z.string().uuid().nullable().optional(),
  page_slug: z.string().max(100).nullable().optional(),
  action: z.enum(["accepted", "rebuilt", "rated", "section_edited", "section_deleted", "section_added"]),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

async function requireAdmin(req: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) {
  const user = await db
    .selectFrom("users")
    .select("email")
    .where("id", "=", req.user.sub)
    .executeTakeFirst();
  if (!user || !config.adminEmails.has(user.email)) {
    return reply.forbidden("Admin access required.");
  }
}

export const aiAnalyticsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  // POST /api/sites/:id/quality-signal — record a user feedback signal
  app.post("/api/sites/:id/quality-signal", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const body = signalBodySchema.safeParse(req.body);
    if (!body.success) {
      return reply.badRequest(body.error.issues.map(i => i.message).join("; "));
    }

    const row = await db
      .insertInto("site_quality_signals")
      .values({
        site_id: id,
        ai_call_id: body.data.ai_call_id ?? null,
        page_slug: body.data.page_slug ?? null,
        action: body.data.action,
        rating: body.data.rating ?? null,
        metadata: body.data.metadata ? JSON.stringify(body.data.metadata) : null,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return { id: row.id };
  });

  // GET /api/ai-analytics — aggregate stats for the current user's sites
  app.get("/api/ai-analytics", async (req, reply) => {
    const bySite = await db
      .selectFrom("ai_calls")
      .innerJoin("sites", "sites.id", "ai_calls.site_id")
      .select(({ fn }) => [
        "ai_calls.site_id",
        "sites.name as site_name",
        "ai_calls.operation",
        "ai_calls.model",
        fn.count<number>("ai_calls.id").as("call_count"),
        fn.sum<number>("ai_calls.input_tokens").as("total_input_tokens"),
        fn.sum<number>("ai_calls.output_tokens").as("total_output_tokens"),
        fn.sum<number>("ai_calls.cost_usd").as("total_cost_usd"),
        fn.avg<number>("ai_calls.duration_ms").as("avg_duration_ms"),
      ])
      .where("sites.user_id", "=", req.user.sub)
      .groupBy(["ai_calls.site_id", "sites.name", "ai_calls.operation", "ai_calls.model"])
      .orderBy("total_cost_usd", "desc")
      .execute();

    const signals = await db
      .selectFrom("site_quality_signals")
      .innerJoin("sites", "sites.id", "site_quality_signals.site_id")
      .select(({ fn }) => [
        "site_quality_signals.site_id",
        "site_quality_signals.action",
        fn.count<number>("site_quality_signals.id").as("count"),
        fn.avg<number>("site_quality_signals.rating").as("avg_rating"),
      ])
      .where("sites.user_id", "=", req.user.sub)
      .groupBy(["site_quality_signals.site_id", "site_quality_signals.action"])
      .execute();

    return { by_site: bySite, signals };
  });

  // GET /api/sites/:id/ai-calls — recent AI calls for a site
  app.get("/api/sites/:id/ai-calls", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const calls = await db
      .selectFrom("ai_calls")
      .select([
        "id", "operation", "model", "input_tokens", "output_tokens",
        "cost_usd", "duration_ms", "created_at",
      ])
      .where("site_id", "=", id)
      .orderBy("created_at", "desc")
      .limit(100)
      .execute();

    return calls;
  });

  // ── Block instruction store — admin only ─────────────────────────────────────

  const instructionBodySchema = z.object({
    block_type: z.string().nullable().optional(),
    field_name: z.string().nullable().optional(),
    instruction: z.string().min(1).max(2000),
    active: z.boolean().optional(),
  });

  // GET /api/block-instructions — list all instructions + available block types
  app.get("/api/block-instructions", { preHandler: requireAdmin }, async (_req, reply) => {
    const [instructions, blockTypes] = await Promise.all([
      db.selectFrom("block_instructions")
        .selectAll()
        .orderBy("block_type", "asc")
        .orderBy("field_name", "asc")
        .orderBy("created_at", "asc")
        .execute(),
      Promise.resolve(registry.getTypes()),
    ]);
    return { instructions, block_types: blockTypes };
  });

  // POST /api/block-instructions — add a new instruction
  app.post("/api/block-instructions", { preHandler: requireAdmin }, async (req, reply) => {
    const body = instructionBodySchema.safeParse(req.body);
    if (!body.success) return reply.badRequest(body.error.issues.map(i => i.message).join("; "));

    // field_name without block_type is not a valid scope
    if (body.data.field_name && !body.data.block_type) {
      return reply.badRequest("field_name requires block_type to be set.");
    }

    const row = await db
      .insertInto("block_instructions")
      .values({
        block_type: body.data.block_type ?? null,
        field_name: body.data.field_name ?? null,
        instruction: body.data.instruction,
        active: body.data.active ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return row;
  });

  // PATCH /api/block-instructions/:instrId — update instruction or toggle active
  app.patch("/api/block-instructions/:instrId", { preHandler: requireAdmin }, async (req, reply) => {
    const { instrId } = req.params as { instrId: string };
    const body = instructionBodySchema.partial().safeParse(req.body);
    if (!body.success) return reply.badRequest(body.error.issues.map(i => i.message).join("; "));

    // Strip undefined AND null to prevent accidentally nulling out scope fields
    const updateFields = Object.fromEntries(
      Object.entries(body.data).filter(([, v]) => v !== undefined && v !== null)
    ) as Partial<typeof body.data>;

    if (Object.keys(updateFields).length === 0) {
      return reply.badRequest("No fields to update.");
    }

    const row = await db
      .updateTable("block_instructions")
      .set({ ...updateFields, updated_at: new Date() })
      .where("id", "=", instrId)
      .returningAll()
      .executeTakeFirst();

    if (!row) return reply.notFound();
    return row;
  });

  // DELETE /api/block-instructions/:instrId
  app.delete("/api/block-instructions/:instrId", { preHandler: requireAdmin }, async (req, reply) => {
    const { instrId } = req.params as { instrId: string };
    const deleted = await db
      .deleteFrom("block_instructions")
      .where("id", "=", instrId)
      .returning("id")
      .executeTakeFirst();

    if (!deleted) return reply.notFound();
    return reply.code(204).send();
  });
};
