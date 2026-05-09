import "dotenv/config";
import path from "node:path";

function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 5432,
    user: u.username,
    password: u.password || undefined,
    database: u.pathname.slice(1),
  };
}

const dbFromUrl = process.env.DATABASE_URL ? parseDbUrl(process.env.DATABASE_URL) : null;

export const config = {
  port: Number(process.env.PORT ?? 3000),
  baseDomain: process.env.BASE_DOMAIN ?? "localhost",
  cloudflare: {
    apiToken:       process.env.CF_API_TOKEN ?? "",
    zoneId:         "666e54a1fed75236f6c03027d4c35060",
    accountId:      "f205a9e41cb389ec4f222a1732d442e1",
    cnameTarget:    process.env.CF_CNAME_TARGET ?? "proxy.onboardagent.com",
    r2Bucket:       process.env.CF_R2_BUCKET ?? "webhost-sites",
    r2AccessKeyId:  process.env.CF_R2_ACCESS_KEY_ID ?? "",
    r2SecretKey:    process.env.CF_R2_SECRET_KEY ?? "",
  },
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:3000/api/auth/google/callback",
  },
  sitesDir: path.resolve(process.env.SITES_DIR ?? "./data/sites"),
  db: dbFromUrl ?? {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_NAME ?? "webhost",
  },
} as const;
