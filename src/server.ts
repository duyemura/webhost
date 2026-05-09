import "dotenv/config";
import Fastify, { type FastifyRequest, type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import cookie from "@fastify/cookie";
import sensible from "@fastify/sensible";
import multipart from "@fastify/multipart";
import staticFiles from "@fastify/static";
import { fastifyOauth2 } from "@fastify/oauth2";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { authRoutes } from "./routes/auth.js";
import { sitesRoutes } from "./routes/sites.js";
import { uploadRoutes } from "./routes/upload.js";
import { scriptsRoutes } from "./routes/scripts.js";
import { siteServer } from "./plugins/site-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: { level: "info" } });

await app.register(cors, { origin: true, credentials: true });
await app.register(sensible);
await app.register(cookie);
await app.register(jwt, { secret: config.jwtSecret });
await app.register(multipart, { limits: { fileSize: 100 * 1024 * 1024 } });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
await app.register(fastifyOauth2 as any, {
  name: "googleOAuth2",
  scope: ["openid", "email", "profile"],
  credentials: {
    client: {
      id: config.google.clientId,
      secret: config.google.clientSecret,
    },
    auth: fastifyOauth2.GOOGLE_CONFIGURATION,
  },
  startRedirectPath: "/api/auth/google",
  callbackUri: config.google.callbackUrl,
});

app.decorate(
  "authenticate",
  async function (req: FastifyRequest, reply: FastifyReply) {
    try {
      await req.jwtVerify();
    } catch {
      return reply.unauthorized("Valid authentication token required.");
    }
  }
);

// Site serving must be registered before API routes so subdomain requests
// are intercepted by the onRequest hook before reaching any route handler
await app.register(siteServer);

app.get("/api/health", async () => ({ ok: true }));

await app.register(authRoutes);
await app.register(sitesRoutes);
await app.register(uploadRoutes);
await app.register(scriptsRoutes);

// Serve the built dashboard in production. In dev, Vite runs separately on port 5173.
const webDist = path.join(__dirname, "..", "web", "dist");
try {
  await app.register(staticFiles, { root: webDist, prefix: "/" });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api/")) {
      return reply.status(404).send({ message: "Not found", statusCode: 404 });
    }
    return reply.sendFile("index.html");
  });
} catch {
  // web/dist not built yet — skip static serving in dev
}

await app.listen({ port: config.port, host: "0.0.0.0" });
