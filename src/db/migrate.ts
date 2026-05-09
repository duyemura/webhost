import "dotenv/config";
import pg from "pg";
import { config } from "../config.js";

const sql = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Migration: switch from password auth to Google OAuth
  ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
  CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_idx ON users(google_id) WHERE google_id IS NOT NULL;
  ALTER TABLE users DROP COLUMN IF EXISTS password_hash;

  CREATE TABLE IF NOT EXISTS sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    custom_domain TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    CONSTRAINT slug_format CHECK (slug ~ '^[a-z0-9-]+$')
  );

  CREATE INDEX IF NOT EXISTS sites_user_id_idx ON sites(user_id);
  CREATE INDEX IF NOT EXISTS sites_slug_idx ON sites(slug);
  CREATE INDEX IF NOT EXISTS sites_custom_domain_idx ON sites(custom_domain) WHERE custom_domain IS NOT NULL;

  CREATE TABLE IF NOT EXISTS scripts (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,
    label       TEXT NOT NULL,
    tracking_id TEXT,
    code        TEXT,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS scripts_site_id_idx ON scripts(site_id);

  -- Phase 3.2: Cloudflare for SaaS custom hostname tracking
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS domain_status TEXT NOT NULL DEFAULT 'none';
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS cloudflare_hostname_id TEXT;
`;

const client = new pg.Client(config.db);
await client.connect();
try {
  await client.query(sql);
  console.log("Migration complete");
} finally {
  await client.end();
}
