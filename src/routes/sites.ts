import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import path from "node:path";
import fs from "node:fs/promises";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { slugify } from "../auth.js";

const createBody = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(63).optional(),
});

const updateBody = z.object({
  name: z.string().min(1).max(100).optional(),
  custom_domain: z.string().min(1).nullable().optional(),
});

export const sitesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.get("/api/sites", async (req) => {
    return db
      .selectFrom("sites")
      .selectAll()
      .where("user_id", "=", req.user.sub)
      .orderBy("created_at", "desc")
      .execute();
  });

  app.post("/api/sites", async (req, reply) => {
    const body = createBody.safeParse(req.body);
    if (!body.success) {
      return reply.badRequest(body.error.issues[0]?.message ?? "Invalid input");
    }

    const { name } = body.data;
    let slug = body.data.slug ? slugify(body.data.slug) : slugify(name);

    if (!slug) {
      return reply.badRequest(
        "Could not generate a valid slug from the site name."
      );
    }

    // Make slug unique by appending a short random suffix if taken
    const existing = await db
      .selectFrom("sites")
      .select("id")
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (existing) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    const site = await db
      .insertInto("sites")
      .values({ user_id: req.user.sub, name, slug })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Create the site directory
    await fs.mkdir(path.join(config.sitesDir, site.id), { recursive: true });

    return reply.status(201).send(site);
  });

  app.get("/api/sites/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .selectAll()
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();
    return site;
  });

  app.patch("/api/sites/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateBody.safeParse(req.body);
    if (!body.success) {
      return reply.badRequest(body.error.issues[0]?.message ?? "Invalid input");
    }

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const updated = await db
      .updateTable("sites")
      .set({ ...body.data, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });

  app.delete("/api/sites/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    await db.deleteFrom("sites").where("id", "=", id).execute();

    // Remove site files
    const siteDir = path.join(config.sitesDir, id);
    await fs.rm(siteDir, { recursive: true, force: true });

    return reply.status(204).send();
  });

  // List files for a site
  app.get("/api/sites/:id/files", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select("id")
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    const siteDir = path.join(config.sitesDir, id);
    const files = await collectFiles(siteDir, siteDir);
    return { files };
  });
};

async function collectFiles(
  dir: string,
  root: string
): Promise<{ path: string; size: number }[]> {
  const results: { path: string; size: number }[] = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await collectFiles(full, root)));
      } else {
        const stat = await fs.stat(full);
        results.push({
          path: full.slice(root.length + 1),
          size: stat.size,
        });
      }
    }
  } catch {
    // directory doesn't exist yet
  }
  return results;
}
