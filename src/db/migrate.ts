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

  -- Phase 4.2: Draft/live split — live slot is what the custom domain serves
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS live_published_at TIMESTAMPTZ;

  -- Track when draft content last changed (files only), separate from updated_at
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMPTZ;

  -- Phase 5: AI-generated page spec + theme
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS spec JSONB;
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme JSONB;
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS generation_prompt TEXT;

  -- Phase 6: Theme lineage + publish snapshot
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS theme_preset TEXT;
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS published_theme JSONB;

  -- Phase 8: Brand kit (colors, fonts, logo — separate from layout preset)
  ALTER TABLE sites ADD COLUMN IF NOT EXISTS brand_kit JSONB;

  -- Social proof: GMB rating, review count, and review snippets
  ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gmb_rating NUMERIC(3,1);
  ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gmb_review_count INTEGER;
  ALTER TABLE business_profiles ADD COLUMN IF NOT EXISTS gmb_reviews JSONB;

  -- Phase 7: Media asset storage
  CREATE TABLE IF NOT EXISTS assets (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type   TEXT NOT NULL,
    size        INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(site_id, filename)
  );
  CREATE INDEX IF NOT EXISTS assets_site_id_idx ON assets(site_id);

  -- Phase 4.1: Business profile for SEO/structured data injection
  CREATE TABLE IF NOT EXISTS business_profiles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id     UUID NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
    biz_name    TEXT,
    description TEXT,
    phone       TEXT,
    email       TEXT,
    address     TEXT,
    city        TEXT,
    state       TEXT,
    zip         TEXT,
    country     TEXT NOT NULL DEFAULT 'US',
    website_url TEXT,
    hours       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Phase 9: Generalised cost tracking (AI, API, storage, DNS, etc.)
  CREATE TABLE IF NOT EXISTS cost_events (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id            UUID REFERENCES sites(id) ON DELETE SET NULL,
    type               TEXT NOT NULL DEFAULT 'ai',
    vendor             TEXT NOT NULL DEFAULT 'anthropic',
    area               TEXT NOT NULL DEFAULT 'site_build',
    operation          TEXT NOT NULL,
    model              TEXT,
    input_tokens       INTEGER,
    output_tokens      INTEGER,
    cache_read_tokens  INTEGER,
    cache_write_tokens INTEGER,
    cost_usd           NUMERIC(10,6) NOT NULL DEFAULT 0,
    duration_ms        INTEGER,
    metadata           JSONB,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS cost_events_site_id_idx  ON cost_events(site_id);
  CREATE INDEX IF NOT EXISTS cost_events_operation_idx ON cost_events(operation);
  CREATE INDEX IF NOT EXISTS cost_events_created_at_idx ON cost_events(created_at);

  -- Backfill historical AI calls into cost_events (idempotent)
  DO $$
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_calls') THEN
      INSERT INTO cost_events (id, site_id, type, vendor, area, operation, model,
        input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
        cost_usd, duration_ms, metadata, created_at)
      SELECT id, site_id, 'ai', 'anthropic',
        CASE WHEN operation ILIKE '%import%' THEN 'site_import' ELSE 'site_build' END,
        operation, model, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens, cost_usd, duration_ms,
        jsonb_build_object('max_tokens', max_tokens),
        created_at
      FROM ai_calls
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END $$;

  -- Phase 9: Quality signals — explicit ratings + implicit edit signals
  CREATE TABLE IF NOT EXISTS site_quality_signals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id         UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    cost_event_id   UUID REFERENCES cost_events(id) ON DELETE SET NULL,
    page_slug       TEXT,
    action          TEXT NOT NULL,
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS site_quality_signals_site_id_idx ON site_quality_signals(site_id);
  CREATE INDEX IF NOT EXISTS site_quality_signals_cost_event_id_idx ON site_quality_signals(cost_event_id);

  -- Migrate legacy ai_call_id FK → cost_event_id, then drop ai_calls
  ALTER TABLE site_quality_signals ADD COLUMN IF NOT EXISTS cost_event_id UUID REFERENCES cost_events(id) ON DELETE SET NULL;
  UPDATE site_quality_signals SET cost_event_id = ai_call_id WHERE ai_call_id IS NOT NULL AND cost_event_id IS NULL;
  ALTER TABLE site_quality_signals DROP COLUMN IF EXISTS ai_call_id;
  DROP TABLE IF EXISTS ai_calls;

  -- Phase 10: Block-level generation instruction store (no code deploy to update)
  CREATE TABLE IF NOT EXISTS block_instructions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_type  TEXT,            -- null = applies to all blocks
    field_name  TEXT,            -- null = block-level instruction (not field-specific)
    instruction TEXT NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT field_name_requires_block_type CHECK (field_name IS NULL OR block_type IS NOT NULL)
  );
  CREATE INDEX IF NOT EXISTS block_instructions_block_type_idx ON block_instructions(block_type) WHERE active = true;
`;

const client = new pg.Client(config.db);
await client.connect();
try {
  await client.query(sql);
  console.log("Migration complete");
} finally {
  await client.end();
}
