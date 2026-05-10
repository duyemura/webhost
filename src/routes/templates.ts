import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyPluginAsync } from "fastify";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.join(__dirname, "..", "templates");

interface TemplateManifest {
  id: string;
  name: string;
  description: string;
  theme_preset: string;
  preview_image: string | null;
  blocks: unknown[];
}

function loadTemplate(filename: string): TemplateManifest {
  const raw = fs.readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8");
  return JSON.parse(raw) as TemplateManifest;
}

const TEMPLATES: TemplateManifest[] = [
  loadTemplate("dark-industrial.json"),
];

export const templatesRoutes: FastifyPluginAsync = async (app) => {
  // Public — no auth required
  app.get("/api/templates", async (_req, reply) => {
    const list = TEMPLATES.map(({ id, name, description, theme_preset, preview_image }) => ({
      id,
      name,
      description,
      theme_preset,
      preview_image,
    }));
    reply.send(list);
  });

  app.get("/api/templates/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const template = TEMPLATES.find(t => t.id === id);
    if (!template) return reply.notFound();
    reply.send(template);
  });
};
