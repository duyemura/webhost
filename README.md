# Webhost

A website hosting and management platform for small business owners. Owners upload a zip of their AI-generated site and get a live URL instantly.

See [PHASES.md](./PHASES.md) for the full product plan.

---

## Prerequisites

- Node.js 24+
- pnpm
- PostgreSQL (local or via `brew install postgresql@16`)

## Local setup

```bash
# 1. Install dependencies
pnpm install
cd web && pnpm install && cd ..

# 2. Copy env and configure
cp .env.example .env
# Edit .env — see "Environment variables" section below

# 3. Create the database
createdb webhost

# 4. Run migrations
pnpm migrate

# 5. Start the API server (port 3000)
pnpm dev

# 6. In a second terminal, start the dashboard (port 5173)
pnpm dev:web
```

Open `http://localhost:5173` to use the dashboard.

## Environment variables

See [.env.example](./.env.example) for all variables with descriptions.

Key variables to configure:

| Variable | Description |
|---|---|
| `DB_HOST` | Postgres host — use `/tmp` for macOS Homebrew socket |
| `DB_USER` | Postgres user — defaults to your macOS username |
| `DB_NAME` | Database name — `webhost` |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3000/api/auth/google/callback` |
| `FRONTEND_URL` | `http://localhost:5173` in dev |

## Google OAuth setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
4. Copy Client ID and Client Secret into `.env`

## Dev without Google OAuth

Use the seed script to create a test user and print a valid JWT:

```bash
pnpm tsx scripts/seed-test-user.ts
```

This upserts `dev@test.com` and prints a token valid for 30 days. Use it directly in API calls:

```bash
TOKEN=<paste token here>

# Verify auth
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/auth/me

# Create a site
curl -X POST http://localhost:3000/api/sites \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Gym"}'

# Upload a zip
curl -X POST http://localhost:3000/api/sites/<id>/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/site.zip"
```

The dashboard at `http://localhost:5173` also accepts the token via URL: `http://localhost:5173?token=<token>`

## How subdomain routing works locally

Sites are served at `{slug}.localhost:3000`. Modern browsers resolve `*.localhost` to `127.0.0.1` automatically — no `/etc/hosts` changes needed.

Example: create a site with slug `crossfit-downtown`, upload files, then visit `crossfit-downtown.localhost:3000`.

## Production build

```bash
pnpm build        # compile TypeScript
pnpm build:web    # build React dashboard into web/dist/
pnpm start        # serve API + dashboard from a single process on port 3000
```
