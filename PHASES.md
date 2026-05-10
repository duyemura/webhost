# Webhost — Phase Plan

## What this product is

A website hosting and management platform for small business owners (gym owners first, but general purpose). Owners use AI tools (Claude, Lovable, Cursor) to generate their site HTML, upload it here, and this platform handles everything else: hosting, DNS, SSL, and ongoing site management.

**What this is not:** We do not generate HTML. Owners bring their own.

---

## Phase 1 — Local MVP

**Goal:** End-to-end working product on localhost. Owner registers, creates a site, uploads a zip, and opens it in the browser at `{slug}.localhost:3000`.

---

### Step 1.1 — Project scaffold

Stand up the skeleton. Everything compiles and runs. No features yet.

- [ ] Directory structure: `src/` (backend), `web/` (frontend), `data/` (gitignored file storage)
- [ ] Root `package.json` — backend deps: `fastify`, `@fastify/jwt`, `@fastify/cors`, `@fastify/multipart`, `@fastify/static`, `@fastify/sensible`, `kysely`, `pg`, `zod`, `bcryptjs`, `adm-zip`, `dotenv`
- [ ] `tsconfig.json` for backend (ESNext, strict)
- [ ] `.env.example` with all required variables documented
- [ ] `.gitignore`
- [ ] `src/config.ts` — typed config object loaded from env vars (port, base domain, JWT secret, DB creds, sites dir)
- [ ] `src/server.ts` — Fastify instance, register plugins, `GET /api/health` returns `{ ok: true }`
- [ ] `src/db/client.ts` — Kysely + pg pool, exported `db` instance
- [ ] Verify: `pnpm dev` starts, `curl localhost:3000/api/health` returns 200
- [ ] `web/package.json` — frontend deps: `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `vite`, `@vitejs/plugin-react`, `tailwindcss`, `autoprefixer`, `postcss`
- [ ] `web/vite.config.ts` — proxy `/api` to `localhost:3000` in dev
- [ ] `web/tailwind.config.ts` + `postcss.config.ts`
- [ ] `web/src/main.tsx` + `web/index.html` — renders "Hello" so we confirm Vite works
- [ ] Verify: `pnpm dev:web` starts, browser shows "Hello"

---

### Step 1.2 — Database schema + migrations

Define and run the schema. No routes yet.

- [ ] `src/db/types.ts` — Kysely interface types for all tables (`Database`, `UsersTable`, `SitesTable`)
- [ ] `src/db/migrate.ts` — runnable migration script (plain SQL via `pg` client, not a migration framework)
- [ ] Migration SQL:
  - `users` table: `id` (uuid), `email` (unique), `password_hash`, `name`, `created_at`
  - `sites` table: `id` (uuid), `user_id` (FK → users), `name`, `slug` (unique, validated format), `custom_domain` (nullable), `created_at`, `updated_at`, `published_at` (nullable)
  - Indexes: `sites.user_id`, `sites.slug`, `sites.custom_domain`
- [ ] Verify: `pnpm migrate` runs cleanly against local Postgres

---

### Step 1.3 — Auth (backend)

Register, login, and protected route middleware. No UI yet.

- [ ] `src/auth.ts` — `hashPassword`, `verifyPassword` (bcryptjs), `slugify` utility
- [ ] `src/types/fastify.d.ts` — augment `FastifyRequest` so `req.user` is typed (`{ sub: string, email: string }`)
- [ ] JWT plugin registered on Fastify instance with `app.authenticate` decorator
- [ ] `src/routes/auth.ts`:
  - `POST /api/auth/register` — validate body (name, email, password ≥ 8 chars), check email unique, hash password, insert user, return JWT + user
  - `POST /api/auth/login` — validate credentials, return JWT + user
  - `GET /api/auth/me` — protected, return current user record
- [ ] Input validation with Zod on all routes
- [ ] Meaningful error messages (not "invalid input" — specific, actionable)
- [ ] Verify with curl: register → login → /me works, bad password returns 401

---

### Step 1.4 — Sites CRUD (backend)

Create, list, read, update, delete sites. No file handling yet.

- [ ] `src/routes/sites.ts` — all routes require `app.authenticate`
- [ ] `POST /api/sites` — body: `{ name, slug? }`, auto-generate slug from name if not provided, append short random suffix if slug already taken, create `data/sites/{id}/` directory, return site
- [ ] `GET /api/sites` — list authenticated user's sites, ordered by `created_at desc`
- [ ] `GET /api/sites/:id` — return site (must belong to current user)
- [ ] `PATCH /api/sites/:id` — update `name` or `custom_domain`
- [ ] `DELETE /api/sites/:id` — delete DB record + remove `data/sites/{id}/` from disk
- [ ] Slug validation: lowercase letters, numbers, hyphens only; max 63 chars
- [ ] Verify: create → list → get → delete round-trip works

---

### Step 1.5 — File upload (backend)

Accept a zip, extract it, store files individually. Core product action.

- [ ] `@fastify/multipart` registered on Fastify
- [ ] `src/routes/upload.ts`:
  - `POST /api/sites/:id/upload` — accept `multipart/form-data` with a zip file field
  - Validate: site must belong to current user
  - Validate: uploaded file is a `.zip` (check mime type + extension)
  - Extract zip with `adm-zip` → write each entry to `data/sites/{id}/{path}`
  - **Path sanitization**: strip any `../` or absolute paths to prevent traversal attacks
  - **File filtering**: skip `__MACOSX/`, `.DS_Store`, `Thumbs.db`, hidden files
  - Mark site `published_at = NOW()` on first successful upload
  - Return `{ filesExtracted: number, files: [{ path, size }] }`
- [ ] `GET /api/sites/:id/files` — walk `data/sites/{id}/` and return file list with paths + sizes
- [ ] `DELETE /api/sites/:id/files` — delete a specific file by path (query param), path-sanitized
- [ ] `POST /api/sites/:id/files` — upload a single file (multipart), writes to `data/sites/{id}/{filename}`
- [ ] Verify: upload a real AI-generated zip, confirm files land on disk correctly

---

### Step 1.6 — Site serving (backend)

Serve site files by subdomain. The magic that makes it feel real.

- [ ] `src/plugins/site-server.ts` — Fastify plugin registered before API routes
- [ ] On every request: parse `Host` header → extract subdomain
  - `{slug}.localhost` → slug = `{slug}`
  - `{slug}.{BASE_DOMAIN}` → slug = `{slug}`
  - If no subdomain match (i.e. bare `localhost` or `app.localhost`) → skip, fall through to API/dashboard routes
- [ ] Look up site by slug in DB
- [ ] If site not found or not yet published → serve a friendly "Site not found" HTML page (not a JSON 404)
- [ ] Serve files from `data/sites/{id}/` — prefer `index.html` at root
- [ ] Fallback chain: exact path → `{path}/index.html` → root `index.html` (supports SPAs)
- [ ] Set correct `Content-Type` headers for `.html`, `.css`, `.js`, `.png`, `.svg`, `.webp`, `.woff2`, etc.
- [ ] Verify: upload a zip at localhost:3000, open `{slug}.localhost:3000` in browser, site renders

---

### Step 1.7 — React dashboard

The owner-facing UI. Functional and clean with Tailwind.

**Layout + shell**
- [ ] `web/src/components/Layout.tsx` — sidebar nav (logo placeholder, "Sites", logout) + main content area
- [ ] Tailwind base styles: neutral gray palette, clean typography, consistent spacing
- [ ] `web/src/components/ui/` — Button, Card, Badge, Input, Label (simple Tailwind components, no library)

**Auth flow**
- [ ] `web/src/context/AuthContext.tsx` — stores JWT + user, exposes `login`, `logout`, `register`
- [ ] `web/src/api.ts` — fetch wrapper that attaches `Authorization: Bearer {token}`, throws on non-2xx
- [ ] `web/src/pages/Login.tsx` — email + password form, link to register
- [ ] `web/src/pages/Register.tsx` — name + email + password form, link to login
- [ ] `web/src/components/ProtectedRoute.tsx` — redirects to `/login` if not authenticated
- [ ] `web/src/App.tsx` — router: `/login`, `/register`, `/` (protected dashboard), `/sites/:id` (protected site detail)

**Sites list (dashboard home)**
- [ ] `web/src/pages/Dashboard.tsx` — grid of site cards, "Create site" button
- [ ] Site card: name, slug, status badge (Published / No files yet), live URL link, "Manage" button
- [ ] Create site modal: name input + optional slug input, slug preview updates live as name is typed
- [ ] Empty state: friendly message + prompt to create first site

**Site detail**
- [ ] `web/src/pages/SiteDetail.tsx` — back link, site name + settings, URL bar, upload zone, file list
- [ ] URL bar: shows `{slug}.localhost:3000`, copy-to-clipboard button, "Open" link
- [ ] `web/src/components/Dropzone.tsx` — drag-and-drop zone for zip upload, progress indicator, success/error state
- [ ] Upload triggers `POST /api/sites/:id/upload`, shows extracted file count on success
- [ ] File list: table of `path` + `size`, delete button per file
- [ ] Danger zone: "Delete site" button → confirmation dialog → delete + redirect to dashboard

---

### Step 1.8 — Integration pass + local smoke test

Wire everything together and verify the full owner journey end-to-end.

- [ ] Vite dev proxy confirmed working (dashboard at `localhost:5173` hits API at `localhost:3000`)
- [ ] Dashboard is also served from Fastify in production mode (built static files at `web/dist/`)
- [ ] Full journey test:
  1. Register new account
  2. Create a site
  3. Upload a zip (use a real AI-generated site)
  4. Open `{slug}.localhost:3000` — site renders correctly
  5. Add a single file via the file upload button
  6. Delete a file
  7. Delete the site — confirm files are removed from disk
- [ ] README with local dev setup instructions (prereqs, `pnpm install`, `pnpm migrate`, `pnpm dev` + `pnpm dev:web`)

---

## Phase 2 — Script management

**Goal:** Owner can connect third-party tools without touching their HTML.

- [ ] Script manager UI in dashboard
- [ ] Predefined integrations: Google Tag Manager, GA4, Meta Pixel, Hotjar, Intercom, Crisp, Tidio, Klaviyo
- [ ] Custom code escape hatch (raw `<script>` injection)
- [ ] Injection layer: middleware intercepts HTML responses and injects scripts into `<head>` and before `</body>`
- [ ] "Verify" step: confirm tags are firing on the live site

**Done when:** Owner pastes a GTM container ID and it fires on their site without editing HTML.

---

## Phase 3 — Custom domains + Cloudflare

**Goal:** Owner points `www.mygym.com` at the platform. SSL is automatic.

- [ ] Cloudflare account setup + zone configuration
- [ ] Cloudflare for SaaS integration (custom hostname API)
- [ ] Custom domain UI: owner enters domain → gets one CNAME instruction → done
- [ ] Domain status polling: pending → active
- [ ] Wildcard subdomain for the platform (`{slug}.{platform-domain}.com`)
- [ ] Migrate site serving from local disk to Cloudflare Workers + R2
- [ ] SSL: Cloudflare issues and renews certs automatically

**Done when:** Owner adds one CNAME at their registrar and their domain is live with SSL within minutes.

---

## Phase 3.5 — Guided publish experience

**Goal:** Publish feels like a deliberate, trustworthy moment — not a silent button click. The owner knows exactly what's going live, feels confident the site is ready, and sees evidence that the platform is doing thoughtful work on their behalf.

The publish flow replaces the current one-click button with a multi-step modal that runs pre-flight checks, gives honest feedback on what's ready and what's missing, then confirms success with a clear summary. Nothing blocks publishing — the checks are advisory, not gates.

---

### Step 3.5.1 — Pre-flight checks

Before rendering anything, evaluate the site's readiness across three categories and surface the results to the owner.

**Content checks**
- Does the site have at least one page with content? (hero block or equivalent)
- Are page titles set and meaningful (not empty or placeholder text)?
- Is there at least one way to contact the business (phone, email, or contact page)?

**Business info checks**
- Is the business name filled in?
- Is a description set? (powers meta description and OG description)
- Is there address or location data? (enables Google Maps / schema.org)

**SEO readiness**
- Will every page have a `<title>` tag?
- Will every page have a `<meta description>`? (requires business description to be set)
- Are Open Graph tags in place? (og:title, og:description, og:url)
- Is there a `sitemap.xml`?

Display these as a checklist with pass / advisory / missing states. Passed items feel good; advisory items have a one-line tip; missing items are honest but not alarming. Owner can choose to fix them now or proceed anyway.

---

### Step 3.5.2 — Confirm publish intent

After the checklist, show a brief summary of what's about to go live:

- Site name and live URL (`{slug}.onboardagent.com` or custom domain if set)
- Number of pages being published
- Any advisory items with a short "You can fix this later" note

Include a primary "Publish site" button and a secondary "Go back and fix" link. The tone should feel like a competent assistant, not a warning system.

---

### Step 3.5.3 — Live publishing with progress feedback

When the owner clicks "Publish site", show real progress instead of a spinner:

1. **Rendering pages** — "Building your Home page…", "Building your Contact page…" (per page, with page title)
2. **Generating sitemap** — "Creating sitemap.xml so search engines can find every page…"
3. **Publishing** — "Sending files to Cloudflare…" (or equivalent infrastructure note)
4. **Done** — Celebration moment: "Your site is live." with the live URL and a big "Open site" button

Each step completes before the next begins. The copy at each step should reinforce that the platform is doing real, thoughtful work — not just copying files.

---

### Step 3.5.4 — Post-publish confirmation

After success, show a summary card:

- Live URL (large, copyable, with "Open" button)
- Pages published (list with titles)
- What's automatically included: "We've added search engine tags, a sitemap, and social sharing previews to every page."
- If custom domain is set: domain + SSL status
- If any advisory items were flagged: a short "Next steps" section with 1–2 suggested improvements

This is the moment the owner feels proud. The copy and design should match that.

---

### Step 3.5.5 — Publish on re-generate / block edit

Publishing is also triggered (or suggested) automatically after:
- AI re-generation — show "Your site has been regenerated. Publish to make changes live." with a shortcut to the publish flow
- Block editor save — if draft differs from live, show the "Publish changes" button in the header, which runs the same guided flow (abbreviated — skip the full checklist on re-publish, just confirm + progress)

---

**Done when:** Owner clicks "Publish" and comes away feeling like the platform did something real for them — not just copied files to a server.

---

## Phase 4 — Site retrofit + optimization suite

**Goal:** Owner clicks one button and their AI-generated site is audited and improved across every dimension that affects findability, shareability, and lead conversion — without a redesign.

Each optimizer runs independently and can be triggered individually or all at once from the dashboard. All changes are previewed as a diff before being applied; nothing is saved without explicit owner approval.

### Optimizers

**SEO**
- Inject `<title>` if missing or too short/generic
- Inject `<meta name="description">` if missing
- Add `<link rel="canonical">` with the site's own URL
- Add `<meta name="robots" content="index, follow">` if missing
- Ensure one `<h1>` per page; flag pages with zero or multiple h1s
- Add `alt` attributes to `<img>` tags that are missing them (AI-generated from src/context)
- Generate and serve `sitemap.xml` automatically from the file list

**AEO (Answer Engine Optimization — for AI search: Perplexity, ChatGPT search, Google SGE)**
- Inject `<meta name="description">` with a direct, factual first sentence (AI-written from page content)
- Identify FAQ-like content and wrap it in `schema.org/FAQPage` JSON-LD
- Add E-E-A-T signals: author, business name, last-updated meta
- Ensure headings are question-shaped where content supports it (helps LLMs extract answers)

**Social sharing**
- Inject full Open Graph block: `og:title`, `og:description`, `og:url`, `og:type`, `og:image`
- Inject Twitter/X card meta: `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- AI-generate OG descriptions from page content if not present
- OG image: use first `<img>` found on the page, or generate a branded fallback (Phase 4+)

**Structured data (schema.org)**
- `LocalBusiness` / `GymOrSportsClub` JSON-LD injected via serving layer (name, address, phone, hours, URL)
- `FAQPage` where FAQ-like sections are detected
- `BreadcrumbList` on multi-page sites
- `Event` for class schedule pages (if detectable)
- Owner fills in a simple business info form in the dashboard; AI maps it to the correct schema types

**Conversion (human)**
- Audit: is there a phone number visible above the fold?
- Audit: is there a clear primary CTA (`<a>` or `<button>`) in the first viewport?
- Audit: does every page link back to a contact/booking page?
- Suggestion: add a sticky CTA bar if none exists (owner approves HTML diff)
- Suggestion: add a `tel:` link around any detected phone numbers

**Google Business Profile (GBP / GMB)**
- NAP consistency check: ensure Name, Address, Phone on the site match what the owner entered in the business info form
- Schema.org `LocalBusiness` keeps GMB signals consistent
- Guidance: link to owner's GBP listing with `sameAs` in JSON-LD
- Future: surface GBP review widget snippet

**Accessibility (a11y) — also a ranking signal**
- Flag missing `lang` attribute on `<html>`
- Flag images without `alt`
- Flag low-contrast text (static analysis of inline styles)
- Flag form inputs without associated `<label>`

### Dashboard UX

- **Site health score** on the site detail page — a simple A/B/C/D grade across the categories above
- **Per-category drill-down** — "Your site is missing OG tags on 3 pages. Fix now →"
- **One-click apply** per optimizer — shows a diff, owner clicks Apply
- **All optimizers are additive** — they inject or modify HTML at serve time (like scripts), never destructively rewrite the owner's files unless the owner explicitly saves the retrofit

**Done when:** Owner clicks "Optimize for search" and their site goes from a bare AI export to a fully tagged, schema-marked, OG-ready, CTA-visible page — in one click, with a preview of every change.

---

## Phase 5 — PushPress integration

**Goal:** The website becomes a live, functional front door for the gym — not just a brochure. PushPress data powers the site automatically and leads flow directly into PushPress.

### Data + SEO layer
- PushPress OAuth — owner links their account once
- Pull and sync business data: name, address, phone, hours, social links
- Auto-populate the Phase 4 business info form (no manual entry)
- Keep schema.org JSON-LD fresh via webhook when PushPress data changes

### Live schedule
- Embed a class schedule on any page via a `<pp-schedule>` web component or iframe widget
- Schedule pulls live from PushPress API — always current, no re-uploading HTML
- Owner controls which programs/class types to show
- Schema.org `Event` injection for upcoming classes (helps Google surface them in search)

### Coach and trainer profiles
- Pull coach roster from PushPress
- Inject `schema.org/Person` + `schema.org/Employee` structured data
- Optional: auto-generate or populate a `/coaches` page from PushPress data
- Schema signals coach expertise (E-E-A-T) for SEO

### Lead flow
- Embed a lead capture form (name, email, phone, goal) that submits directly to PushPress CRM
- "Book a free intro" CTA wired to PushPress appointment booking
- Lead attribution: track which page/CTA the lead came from
- Conversion optimizer (Phase 4) surfaces missing CTAs and suggests the PushPress lead form

### Future within this phase
- Membership pricing page auto-generated from PushPress plan data
- Trial/intro offer landing pages
- Member testimonials pulled from PushPress (if review data available)

**Done when:** A gym owner links PushPress, and their site automatically shows live class times, coach profiles, and a working "Book a free intro" form — with zero HTML editing.

---

## Phase 6 — AI inline editor

**Goal:** Owner can update individual pages and the AI understands the full site context.

- [ ] File browser in dashboard — view, replace, or delete individual files
- [ ] Inline code editor (Monaco or CodeMirror) for direct HTML/CSS edits
- [ ] AI assistant: when a new page is uploaded, AI identifies disconnected pages and offers to update nav/links
- [ ] AI suggestions: missing meta tags, broken internal links, accessibility issues
- [ ] "What changed" diff view before publishing an AI suggestion

**Done when:** Owner uploads a new `team.html`, AI says "I noticed this isn't linked anywhere — want me to add it to your nav?" and does it in one click.

---

## Future / Backlog

- **Form handling** — receive form submissions (contact forms) without a backend
- **Basic analytics** — page views, top pages, referrers (Cloudflare or Plausible)
- **Team / multi-user** — invite staff to manage the site
- **Site versioning** — keep last N deploys, one-click rollback
- **Deploy previews** — staging URL before making a new upload live
- **Email forwarding** — `hello@mygym.com` → Gmail via Cloudflare Email Routing
- **Generated schema** — from PushPress data + site content, keep schema.org fresh automatically

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| API | Fastify 5 + TypeScript | Familiar to PushPress engineers |
| Database | PostgreSQL + Kysely | Same as rest of PushPress |
| Dashboard | React 19 + Vite + Tailwind | Simple, clean UI |
| File serving (local) | Fastify + subdomain routing | Phase 1 only |
| File serving (prod) | Cloudflare Workers + R2 | Phase 3+ |
| Custom domains + SSL | Cloudflare for SaaS | $0.10/hostname/mo, first 100 free |
| Deploy target | TBD (Railway or similar) | Decided when going live |

---

## Key design decisions

- **Subdomains, not paths** — `{slug}.platform.com` not `platform.com/{slug}`. Cleaner, works with custom domains, feels like a real site.
- **Files stored individually, zip is just import** — the canonical store is always individual files. Zips are extracted on upload. This enables per-file updates and future AI editing without full re-uploads.
- **Script injection in the serving layer** — owner never edits HTML. Scripts stored in DB, injected on every response. Works the same locally (Fastify middleware) and in production (CF Worker).
- **Cloudflare for SaaS for custom domains** — solves SSL for arbitrary custom domains with one CNAME. No cert management code needed.
- **AI editor is its own phase** — the "connected pages" problem (new page not linked in nav) is real but complex. Surfaced as a future AI feature rather than a blocker for upload.
