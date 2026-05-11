import type { FastifyPluginAsync } from "fastify";
import { db } from "../db/client.js";
import { deletePrefix, putFile } from "../lib/r2.js";
import type { SiteSpec } from "../blocks/types.js";
import { renderSpecPage } from "../render/pipeline.js";

export const publishRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", app.authenticate);

  app.post("/api/sites/:id/publish", async (req, reply) => {
    const { id } = req.params as { id: string };

    const site = await db
      .selectFrom("sites")
      .select(["id", "published_at", "spec", "theme", "brand_kit", "slug", "custom_domain", "cta_url", "cta_label"])
      .where("id", "=", id)
      .where("user_id", "=", req.user.sub)
      .executeTakeFirst();

    if (!site) return reply.notFound();
    if (!site.spec) return reply.badRequest("Generate a site before publishing.");

    const spec = site.spec as SiteSpec;

    const [profile, scripts] = await Promise.all([
      db
        .selectFrom("business_profiles")
        .selectAll()
        .where("site_id", "=", id)
        .executeTakeFirst(),
      db
        .selectFrom("scripts")
        .selectAll()
        .where("site_id", "=", id)
        .where("enabled", "=", true)
        .orderBy("created_at", "asc")
        .execute(),
    ]);

    await deletePrefix(`live/${id}/`);

    await Promise.all(
      spec.pages.map(async (page) => {
        const requestPath = page.slug === "index" ? "/" : `/${page.slug}`;
        const html = await renderSpecPage(site, profile ?? null, scripts, requestPath);
        if (!html) return;
        const key =
          page.slug === "index"
            ? `live/${id}/index.html`
            : `live/${id}/${page.slug}/index.html`;
        await putFile(key, Buffer.from(html, "utf-8"), "text/html; charset=utf-8");
      })
    );

    const now = new Date();
    const updated = await db
      .updateTable("sites")
      .set({
        live_published_at: now,
        updated_at: now,
        published_theme: site.theme ? JSON.stringify(site.theme) : null,
        ...(site.published_at ? {} : { published_at: now }),
      })
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
