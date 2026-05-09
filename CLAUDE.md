# Webhost — Claude Code Instructions

## What this is

A website hosting platform for small business owners. Owners upload AI-generated HTML (as a zip), get a live URL on a subdomain instantly, and can optionally point a custom domain at it.

Full product plan: [PHASES.md](./PHASES.md)

---

## Domain

**Temporary platform domain: `onboardagent.com`**

This is the live domain until a final brand name is chosen. All references to the platform domain should use `onboardagent.com`.

| Context | Value |
|---|---|
| Platform domain | `onboardagent.com` |
| Site subdomain pattern | `{slug}.onboardagent.com` |
| Dashboard | `app.onboardagent.com` |
| Customer CNAME target | `proxy.onboardagent.com` (Phase 3, not yet configured) |
| Local dev (sites) | `{slug}.localhost:3000` |
| Local dev (dashboard) | `http://localhost:5173` |

When generating any UI strings, instructions, or DNS copy that reference the platform URL, use `onboardagent.com`. When working locally, use `localhost`.

---

## Stack

| Layer | Technology |
|---|---|
| API | Fastify 5 + TypeScript |
| Database | PostgreSQL + Kysely |
| Dashboard | React 19 + Vite + Tailwind |
| File serving (local) | Fastify + subdomain routing |
| File serving (prod) | Cloudflare Workers + R2 (Phase 3+) |
| Custom domains + SSL | Cloudflare for SaaS (Phase 3+) |

---

## Dev commands

```bash
pnpm dev          # API server (port 3000)
pnpm dev:web      # Vite dashboard (port 5173)
pnpm migrate      # Run DB migrations
pnpm build        # Compile TypeScript
pnpm build:web    # Build dashboard
pnpm start        # Serve everything from port 3000 (production mode)
```

---

## Key architecture rules

- **Subdomains, not paths** — sites live at `{slug}.onboardagent.com`, not `onboardagent.com/{slug}`
- **Files stored individually** — zips are extracted on upload; canonical store is always individual files
- **Script injection in the serving layer** — scripts are stored in DB and injected at response time; owners never edit HTML
- **Multi-tenant** — every DB query and every job must be scoped to a `userId` (or `companyId` in PushPress terms)
- **Path sanitization always** — any file path from user input must be sanitized to prevent traversal attacks

---

## Cloudflare (Phase 3 — account configured, not yet wired into code)

**Credentials — non-secret (secrets stay in `.env` only):**
- Zone ID: `666e54a1fed75236f6c03027d4c35060`
- Account ID: `f205a9e41cb389ec4f222a1732d442e1`
- R2 bucket: `webhost-sites`
- API token env var: `CF_API_TOKEN`

**When Phase 3 work begins:**
- Custom hostname API: `POST /zones/666e54a1fed75236f6c03027d4c35060/custom_hostnames`
- Customer instruction: "Add a CNAME from `www.yourdomain.com` to `proxy.onboardagent.com`"
- SSL: Cloudflare issues DV certs automatically once CNAME validates
- DB columns needed: `cf_hostname_id`, `custom_domain_status` (enum: `pending | active | failed`)
- Worker reads `Host` header → looks up site → serves files from R2 bucket `webhost-sites`
