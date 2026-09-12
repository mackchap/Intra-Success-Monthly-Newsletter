# CLAUDE.md — Intra Success Academy

This file orients any engineer (human or AI) working in this repo: the stack,
how the code is organized, conventions to follow, how to run things locally,
and how deploys to Railway work.

## What this is

A business platform combining:
1. **Website** — marketing site + client portal (Next.js)
2. **CRM** — contacts, companies, deals/pipeline, tasks, notes, activity timeline
3. **Funnels** — landing pages, lead capture, multi-step sales funnels, email/SMS automation
4. **Academy** — courses, modules, lessons, enrollment, progress, certificates
5. **Payments** — Stripe Checkout + Billing, webhooks driving CRM/Academy state
6. **AI agents** — Anthropic API tool-calling agents that read/write CRM + Academy data

## Phased build plan

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, auth, full DB schema, first Railway deploy | ✅ done |
| 2 | CRM core (contacts, companies, deals, tasks, notes, timeline UI) | ✅ done (this commit) |
| 3 | Stripe integration + webhooks (products, checkout, subscriptions) | not started |
| 4 | Academy (courses, enrollment, progress, certificates) | not started |
| 5 | Website, client portal, funnel builder | not started |
| 6 | Automation sequences, AI agents, analytics dashboard | not started |

Each phase is built and reviewed before the next starts. Do not jump ahead —
if you're an AI agent continuing this work, check this table and the git log
before assuming what exists.

## Stack

- **Framework**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Database**: PostgreSQL via Prisma (`packages/db`)
- **Auth**: Auth.js (NextAuth v5) — Credentials provider + Prisma adapter, JWT
  sessions carrying a `role` claim (`ADMIN` / `STAFF` / `CUSTOMER`)
- **Background jobs**: BullMQ + Redis, running as a separate worker process
  (`apps/worker`) — never inside the web process
- **Payments**: Stripe (Checkout for one-time purchases, Billing for
  subscriptions/memberships) — added in Phase 3
- **Email**: Resend — added in Phase 6 (interface kept provider-agnostic)
- **SMS**: Twilio — added in Phase 6 (interface kept provider-agnostic)
- **Video**: Mux (primary) / Vimeo embeds — no self-hosted video, added in Phase 4
- **File storage**: Cloudflare R2 (S3-compatible) — no local filesystem storage,
  since Railway containers are stateless
- **AI agents**: Anthropic API with tool calling — added in Phase 6
- **Hosting**: Railway (web service + worker service + Postgres + Redis plugins)

## Folder structure

```
.
├── apps/
│   ├── web/              Next.js app (marketing site, portal, admin/staff dashboards)
│   │   ├── src/app/      App Router routes (pages + API routes)
│   │   ├── src/auth.ts   Auth.js config (providers, callbacks, session shape)
│   │   ├── src/middleware.ts   Role-based route protection
│   │   └── Dockerfile    Railway build for this service
│   └── worker/           BullMQ worker process (background jobs, no HTTP server)
│       ├── src/index.ts
│       └── Dockerfile    Railway build for this service
├── packages/
│   └── db/               Shared Prisma schema + generated client
│       ├── prisma/schema.prisma   The single source of truth for the DB schema
│       ├── prisma/seed.ts         Dev seed data (default pipeline, admin user)
│       └── src/index.ts           PrismaClient singleton, re-exports Prisma types
├── docker-compose.yml    Local Postgres + Redis for Docker Desktop
├── railway.web.json      Railway config-as-code for the web service
├── railway.worker.json   Railway config-as-code for the worker service
└── .env.example          Every environment variable the app needs
```

This is an **npm workspaces monorepo** (not Turborepo/pnpm) — kept simple on
purpose. `apps/web` and `apps/worker` both depend on `@platform/db`, which
compiles its own `dist/` via `tsc` so it can be `require`d from plain Node
(the worker isn't run through a TS loader in production).

## Conventions

- **Money** is always stored as integer cents (`valueCents`, `amountCents`,
  `priceCents`) with a separate `currency` string. Never store floats for money.
- **Enums over free strings** for anything with a fixed set of states (roles,
  statuses, channels). Free-form/extensible data (funnel page content, quiz
  questions, custom fields) is `Json`.
- **Soft state via status enums**, not boolean flags or deletion — e.g. an
  `Enrollment` is `REVOKED`, not deleted, so history survives a refund.
- **CRM polymorphism**: `Task`, `Note`, and `Activity` relate to `Contact`
  and/or `Deal` via nullable foreign keys rather than a generic polymorphic
  relation — Prisma doesn't support true polymorphism cleanly, and this keeps
  queries simple.
- **Providers are swappable by contract, not by config flag.** `MessageLog`
  and `Sequence`/`SequenceStep` model email/SMS generically; the Resend/Twilio
  calls live behind a small interface in the worker so a provider swap doesn't
  touch CRM/funnel logic. (Built out in Phase 6.)
- **No local file storage.** Uploads go to Cloudflare R2; video goes to
  Mux/Vimeo. The app must run statelessly — assume the filesystem is wiped
  between deploys.
- **Cross-platform scripts only.** All npm scripts must run unmodified on
  Windows (PowerShell) and Linux/macOS. Avoid bash-only syntax (`&&` chains
  are fine — npm itself handles those across `cmd.exe`/PowerShell/bash — but
  avoid things like `${VAR:-default}`, `export FOO=bar`, or `rm -rf`). Use
  Node scripts or cross-platform packages (e.g. `cross-env`) if a script ever
  needs to set an env var inline.
- **Never commit secrets.** `.env` is gitignored; `.env.example` documents
  every variable with a placeholder value.

## Running locally (Windows / PowerShell)

Prereqs: Node 20+, Docker Desktop, npm.

```powershell
# 1. Install dependencies (also builds packages/db via postinstall)
npm install

# 2. Copy env file and fill in real values (DB/Redis URLs below are already
#    correct for the docker-compose services)
Copy-Item .env.example .env

# 3. Start local Postgres + Redis
docker compose up -d

# 4. Apply the schema and seed dev data (default pipeline + an admin user)
npm run db:migrate
npm run db:seed

# 5. Run the web app and worker together
npm run dev
```

- Web app: http://localhost:3000
- Seeded admin login: `admin@example.com` / `changeme123` (override via
  `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` env vars before seeding)
- Prisma Studio (DB browser): `npm run db:studio`

Only `apps/web` needs to run for frontend work; only `apps/worker` needs to
run for background-job work. `npm run dev:web` / `npm run dev:worker` start
them independently.

## Testing

```powershell
npm run test         # runs vitest across every workspace that has tests
npm run typecheck    # tsc --noEmit across every workspace
npm run lint         # eslint (apps/web only, for now)
```

Test coverage priorities as phases land:
- **CRM logic** (Phase 2): stage transitions, activity timeline writes, task/note attachment rules
- **Stripe webhook handling** (Phase 3): signature verification, idempotency via `WebhookEvent`, each event type's side effects (enroll, mark deal won, revoke access on refund)
- **Enrollment/access rules** (Phase 4): drip release timing, prerequisites, membership vs one-time purchase access
- **Agent tool calls** (Phase 6): each tool the agents can invoke, mocked against a test DB

Phase 1 ships a couple of smoke tests (`apps/web/src/app/api/health/route.test.ts`,
`packages/db/src/index.test.ts`) to prove the test pipeline itself works
before there's real business logic to test.

## Database

- Schema lives in `packages/db/prisma/schema.prisma`. It already includes the
  **full** model set for CRM, funnels, academy, and orders (Phase 1 scope),
  even though most of it has no UI/API yet — later phases build features
  against tables that already exist, rather than migrating mid-phase.
- `npm run db:migrate` — creates/applies a dev migration (local only)
- `npm run db:migrate:deploy` — applies pending migrations without prompting
  (this is what runs automatically on every Railway deploy — see below)
- `npm run db:generate` — regenerates the Prisma client after a schema change
- `npm run db:seed` — re-runs `packages/db/prisma/seed.ts`

## CRM (Phase 2)

- Lives under `apps/web/src/app/staff/*` — gated by `middleware.ts` to
  `ADMIN`/`STAFF` (customers never see it). Pages: `contacts`, `companies`,
  `deals` (pipeline board grouped by stage), `tasks`.
- Business logic (not just CRUD) lives in `apps/web/src/lib/crm/*.ts` —
  `deals.ts` (`createDeal`, `moveDealStage`), `notes.ts`, `tasks.ts` — kept
  separate from the page components so it's unit-testable with a mocked
  `@platform/db` (see the `.test.ts` files alongside each). Plain `contacts.ts`/
  `companies.ts` CRUD stayed thin enough not to need the same treatment.
- Every deal-affecting or timeline-worthy action (stage move, note, task)
  writes an `Activity` row in the same service function, never as an
  afterthought in the page/route — that's what keeps the timeline complete.
- **Closing a deal is driven by data, not code**: `PipelineStage.isWon` /
  `isLost` flags mark which stage(s) close a deal. `moveDealStage` checks
  those flags and sets `Deal.status`/`closedAt` + logs `DEAL_WON`/`DEAL_LOST`
  instead of a plain `STAGE_CHANGED` when moving into one. A closed deal
  (`status != OPEN`) refuses further stage moves. If you add a pipeline or
  change stage names, reconcile these flags — the seed script does this via
  `updateMany` on every run rather than only at creation, precisely because
  an existing pipeline from a previous seed run won't get new stage fields
  otherwise (this bit us once during Phase 2 — moving a deal into "Won" that
  had `isWon: false` because the flag was added after the pipeline already
  existed silently logged `STAGE_CHANGED` instead of closing the deal).
- Mutations use Next.js Server Actions (`"use server"`), not a separate API
  layer — forms post directly to actions in `staff/*/actions.ts` or the
  cross-resource `staff/shared-actions.ts` (notes/tasks, used from both
  contact and deal detail pages). Every action re-checks the role via
  `requireStaffSession()` (`apps/web/src/lib/require-staff.ts`) even though
  middleware already gates the route — defense in depth, since a server
  action is invocable directly.
- The deal board is stage columns with a move-to-stage `<select>` + submit,
  not drag-and-drop — deliberately, to avoid pulling in a DnD library for
  Phase 2. Revisit if/when the UI gets a real design pass.
- Pages under `staff/` set `export const dynamic = "force-dynamic"` (on the
  layout, inherited by all of them) — they read live, per-request DB state
  and must never be statically prerendered at build time (which would also
  just fail: there's no `DATABASE_URL` in the build environment).

## Deploying to Railway

Production is two Railway services from this one repo, plus Railway's
Postgres and Redis plugins:

- **web** — the Next.js app (`apps/web`)
- **worker** — the BullMQ background worker (`apps/worker`)

Local dev uses Docker Postgres/Redis; production uses Railway's own
`DATABASE_URL`/`REDIS_URL`, injected automatically by the Postgres/Redis
plugins into every service in the same project. Prisma migrations run
automatically on deploy — the web service's container entrypoint runs
`prisma migrate deploy` before starting the server (see `apps/web/Dockerfile`).

### One-time setup (do this once per environment)

1. **Create the Railway project** and add the **Postgres** and **Redis**
   plugins from the Railway dashboard (New → Database → Postgres / Redis).
   These automatically expose `DATABASE_URL` and `REDIS_URL` to other
   services in the same project if you reference them (see step 4).
2. **Connect this GitHub repo** to Railway (New → GitHub Repo), authorizing
   Railway's GitHub App for `mackchap/intra-success-monthly-newsletter` if
   prompted. Pick the `main` branch as the deploy branch.
3. **Create two services from the same repo**:
   - Service "web": in Settings, set **Root Directory** to `/` (repo root)
     and **Config-as-code file** to `railway.web.json`. This tells Railway to
     build with `apps/web/Dockerfile`.
   - Service "worker": same repo, **Root Directory** `/`, **Config-as-code
     file** `railway.worker.json` (builds with `apps/worker/Dockerfile`).
   - (Railway's UI may call this "Custom Config Path" depending on version —
     look for the setting that lets a service point at a specific
     `railway*.json` instead of the repo-root default.)
4. **Set environment variables** on both the web and worker services. At
   minimum, reference the Postgres/Redis plugins so their variables are
   available (Railway lets you reference `${{Postgres.DATABASE_URL}}` and
   `${{Redis.REDIS_URL}}` directly in a service's variables), then add every
   other variable from `.env.example` with real (test-mode) values:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `REDIS_URL` = `${{Redis.REDIS_URL}}`
   - `AUTH_SECRET`, `AUTH_URL` (`AUTH_URL` = the web service's public domain)
   - `APP_URL` = the web service's public domain
   - Stripe/Resend/Twilio/Mux/R2/Anthropic keys as they're needed by later phases
5. **Generate a public domain** for the web service (Settings → Networking →
   Generate Domain). The worker service does not need one — it has no HTTP
   server.
6. **Deploy.** Railway builds both Dockerfiles and deploys. Check the web
   service's `/api/health` endpoint on its public domain — it should return
   `{"status":"ok","db":"ok"}`. If the DB isn't reachable yet it returns a 503,
   which is expected until the Postgres plugin's variables are wired up.

From here on, every push to `main` redeploys both services automatically.

### Local webhook testing (Stripe) — needed starting Phase 3

```powershell
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_...` value it prints into your local `.env` as
`STRIPE_WEBHOOK_SECRET`. In production, create a webhook endpoint in the
Stripe Dashboard pointing at `https://<your-railway-domain>/api/webhooks/stripe`
and put that endpoint's signing secret into the web service's
`STRIPE_WEBHOOK_SECRET` variable on Railway.

### Going live (Stripe test → live keys)

1. Complete Stripe account activation (business details, bank account).
2. In the Stripe Dashboard, toggle to **Live mode** and copy the live
   `sk_live_...` / `pk_live_...` keys.
3. Create a **second** webhook endpoint in live mode pointing at the same
   Railway URL, and copy its live `whsec_...` secret.
4. Update `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, and
   `STRIPE_WEBHOOK_SECRET` on the Railway **web** service to the live values.
   Test mode and live mode data are entirely separate in Stripe, so nothing
   else needs to change.

## Health check

`GET /api/health` runs `SELECT 1` against Postgres and returns `200` with
`{"status":"ok","db":"ok"}`, or `503` with `{"status":"error","db":"unreachable"}`.
This is what Railway's health check hits before routing traffic to a new
deploy (configured in `railway.web.json`).
