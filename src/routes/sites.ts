import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { config } from "../config.js";
import { slugify } from "../auth.js";
import { deletePrefix } from "../lib/r2.js";
import { provisionHostname, deprovisionHostname, getHostnameStatus } from "../lib/cloudflare.js";

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
      return reply.badRequest("Could not generate a valid slug from the site name.");
    }

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

    // Expose CNAME target so frontend can show correct instructions
    return { ...site, cname_target: config.cloudflare.cnameTarget };
  });

  app.patch("/api/sites/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateBody.safeParse(req.body);
    if (!body.success) {
      return reply.badRequest(body.error.issues[0]?.message ?? "Invalid input");
    }

    const site = await db
      .selectFrom("sites")
      .select(["id", "custom_domain", "cloudflare_hostname_id"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    let domainUpdate: Record<string, unknown> = {};

    if ("custom_domain" in body.data) {
      const newDomain = body.data.custom_domain;

      if (newDomain && newDomain !== site.custom_domain) {
        // Setting a new domain — deprovision old one if any, provision new
        if (site.cloudflare_hostname_id) {
          await deprovisionHostname(site.cloudflare_hostname_id).catch(() => {});
        }
        if (config.cloudflare.apiToken) {
          const result = await provisionHostname(newDomain);
          domainUpdate = {
            cloudflare_hostname_id: result.id,
            domain_status: result.status,
          };
        } else {
          // No Cloudflare token — store domain without provisioning (local dev)
          domainUpdate = { cloudflare_hostname_id: null, domain_status: "none" };
        }
      } else if (newDomain === null && site.cloudflare_hostname_id) {
        // Removing domain
        await deprovisionHostname(site.cloudflare_hostname_id).catch(() => {});
        domainUpdate = { cloudflare_hostname_id: null, domain_status: "none" };
      }
    }

    const updated = await db
      .updateTable("sites")
      .set({ ...body.data, ...domainUpdate, updated_at: new Date() })
      .where("id", "=", id)
      .returningAll()
      .executeTakeFirstOrThrow();

    return { ...updated, cname_target: config.cloudflare.cnameTarget };
  });

  app.delete("/api/sites/:id", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select(["id", "cloudflare_hostname_id"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();

    await db.deleteFrom("sites").where("id", "=", id).execute();

    // Clean up Cloudflare and R2 in parallel
    await Promise.all([
      site.cloudflare_hostname_id
        ? deprovisionHostname(site.cloudflare_hostname_id).catch(() => {})
        : Promise.resolve(),
      deletePrefix(`sites/${id}/`),
      deletePrefix(`live/${id}/`),
    ]);

    return reply.status(204).send();
  });

  // Poll Cloudflare for custom domain status
  app.get("/api/sites/:id/domain-status", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select(["id", "domain_status", "cloudflare_hostname_id"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();
    if (!site.cloudflare_hostname_id) {
      return { status: site.domain_status, ssl_status: "none" };
    }

    const cf = await getHostnameStatus(site.cloudflare_hostname_id);

    // Persist if status changed
    if (cf.status !== site.domain_status) {
      await db
        .updateTable("sites")
        .set({ domain_status: cf.status })
        .where("id", "=", id)
        .execute();
    }

    return cf;
  });
};
