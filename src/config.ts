import "dotenv/config";
import path from "node:path";

export const config = {
  port: Number(process.env.PORT ?? 3000),
  baseDomain: process.env.BASE_DOMAIN ?? "localhost",
  // CNAME target for custom domains — swap to real Cloudflare ingress in Phase 3.2
  platformDomain: process.env.PLATFORM_DOMAIN ?? "localhost",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3000/api/auth/google/callback",
  },
  sitesDir: path.resolve(process.env.SITES_DIR ?? "./data/sites"),
  db: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME ?? "webhost",
  },
} as const;
