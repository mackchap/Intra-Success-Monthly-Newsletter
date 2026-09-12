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
| 2 | CRM core (contacts, companies, deals, tasks, notes, timeline UI) | ✅ done |
| 3 | Stripe integration + webhooks (products, checkout, subscriptions) | ✅ done |
| 4 | Academy (courses, enrollment, progress, certificates) | ✅ done |
| 5 | Website, client portal, funnel builder | ✅ done |
| 6 | Automation sequences, AI agents, analytics dashboard | ✅ done (this commit) |

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

## Payments (Phase 3)

- **Stripe Products/Prices are managed in the Stripe Dashboard (or API), not
  in our admin UI.** They sync into our `Product` table via
  `product.created`/`product.updated`/`price.created`/`price.updated`
  webhooks (`apps/web/src/lib/billing/webhook-handlers.ts`). This mirrors the
  pattern most production Stripe integrations use (see the `dj-stripe`/Vercel
  references in `PRD.md`) and means Phase 3 needed no outbound "create a
  Stripe product" API call from our app — only inbound webhook handling,
  which is fully testable without real Stripe API keys (see below). To make
  a course purchasable, create its Stripe Product with metadata
  `type=COURSE` and `courseId=<our Course id>` (`type=MEMBERSHIP` for a
  recurring subscription product; anything else/missing defaults to
  `FUNNEL_OFFER`). `/admin/products` is a read-only view of what's synced.
- **Checkout**: `apps/web/src/lib/billing/checkout.ts` creates a `PENDING`
  `Order` row *before* redirecting to Stripe, storing its id in the Checkout
  Session's metadata and its `stripeCheckoutSessionId` on the Order — so the
  webhook handler updates a known row by that id instead of reconstructing
  order details from the Stripe event. One Stripe Customer per `User`
  (`User.stripeCustomerId`, created lazily on first purchase and reused for
  every subsequent purchase, subscription, and the billing portal).
- **Webhooks** (`/api/webhooks/stripe`, `apps/web/src/lib/billing/webhook-handlers.ts`):
  - `checkout.session.completed` → marks the `Order` `PAID`; if it has a
    `courseId`, upserts an `ACTIVE`/`STRIPE_PURCHASE` `Enrollment`; if it has
    a `dealId`, closes that CRM deal as won by reusing `moveDealStage` from
    the Phase 2 CRM service layer (finds the pipeline's `isWon` stage) —
    a deliberate cross-phase reuse rather than duplicating close-deal logic.
  - `charge.refunded` → marks the `Order` `REFUNDED` and revokes the
    matching `Enrollment` (`REVOKED` + `revokedAt`).
  - `customer.subscription.created`/`updated`/`deleted` → upserts/cancels
    the `Subscription` row; `deleted` also calls
    `revokeMembershipEnrollments` (Phase 4, `apps/web/src/lib/academy/enrollment.ts`)
    to revoke that user's `MEMBERSHIP`-sourced `Enrollment` rows — see the
    Academy section below for why that's the right place for it (this was
    originally deferred here as a Phase 4 item; closed once Academy's
    Enrollment-centric access model existed to revoke against).
  - Idempotency: every event is recorded in `WebhookEvent` keyed by Stripe's
    event id before dispatching; an event whose `processedAt` is already set
    is skipped. The route returns `500` (not `200`) on a handler error so
    Stripe retries — safe, because the idempotency check means a retry only
    re-attempts work that didn't finish, not already-applied side effects.
  - `apps/web/src/lib/stripe.ts` builds the Stripe client **lazily** (behind
    a `Proxy`), not at module import time — Next.js evaluates route modules
    during `next build`'s page-data collection, before any `.env` is loaded
    for that step (see the `dev`/`build` script split above), so an eager
    `new Stripe(key)` at import time broke the production build.
- **Customer portal**: `apps/web/src/lib/billing/portal.ts` creates a
  Stripe-hosted Billing Portal session for the signed-in user's Stripe
  customer; surfaced as a "Manage billing" button on `/portal`.
- **Testing without real Stripe keys**: `.env` needs *some* string for
  `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` for the app to boot and for
  webhook signature verification to run (that's pure local HMAC — Stripe's
  `Stripe.webhooks.generateTestHeaderString()` helper signs a payload with
  any secret you choose, no network call), but outbound calls
  (`checkout.sessions.create`, `customers.create`, `billingPortal.sessions.create`)
  will fail without a real test-mode `sk_test_...` key. Phase 3 was verified
  by: unit tests mocking the `stripe` client for every handler/checkout/portal
  function, plus a live check hitting the running dev server's
  `/api/webhooks/stripe` with a genuinely HMAC-signed test event (valid,
  replayed, badly-signed, and missing-signature cases) against real
  Postgres — confirming actual DB side effects, not just mocked ones. Once
  real test-mode keys are set, exercise checkout/portal live with
  `stripe listen` per the section below.

## Academy (Phase 4)

- **`Enrollment.status = ACTIVE` is the single source of truth for course
  access**, regardless of how the student got in. Every access path funnels
  through exactly one of four functions in `apps/web/src/lib/academy/enrollment.ts`,
  each creating/activating an `Enrollment` row with a different `source`:
  - `enrollInFreeCourse` — student self-serve, `Course.priceType === FREE`
  - `enrollViaMembership` — student self-serve, requires an `ACTIVE`/`TRIALING`
    `Subscription`; creates a `MEMBERSHIP`-sourced `Enrollment` so drip timing,
    progress, and certificates all have the same anchor regardless of tier
  - Stripe webhook (`checkout.session.completed`, Phase 3) — `STRIPE_PURCHASE`
  - `grantManualEnrollment` — admin/staff support action (`/admin/courses/[id]`
    "Grant access" form), `MANUAL`
  - Revocation is symmetric: `charge.refunded` (Phase 3) revokes a
    `STRIPE_PURCHASE` enrollment; `customer.subscription.deleted` revokes
    `MEMBERSHIP` ones via `revokeMembershipEnrollments`. A one-time purchase
    stays `ACTIVE` regardless of any later subscription changes — only a
    refund touches it.
- **`canAccessLesson`** (`apps/web/src/lib/academy/access.ts`) is the single
  gate everything else goes through — the lesson viewer page, and
  `markLessonComplete`/`updateVideoProgress` (which re-check it rather than
  trusting the page already did). Checks in order: enrollment active → drip
  delay elapsed (`Enrollment.enrolledAt + Lesson.dripDelayDays`) →
  lesson-level prerequisite completed (`LessonProgress`) → course-level
  prerequisite completed (a `Certificate` exists for that prerequisite
  course — completion is defined as "has a certificate," not a separate
  flag). Returns a discriminated result (`{allowed: false, reason, ...}`)
  so the UI can show *why* something is locked, not just that it is.
- **Certificates auto-issue**, no manual step: `checkAndIssueCertificate`
  runs after every `markLessonComplete` call and creates the `Certificate`
  the moment every lesson in the course is done (idempotent — checks for an
  existing one first). The PDF itself is rendered **on demand**
  (`/api/certificates/[id]/pdf`, `apps/web/src/lib/academy/certificate-pdf.ts`,
  via `pdf-lib`) rather than pre-generated and uploaded to R2 at issuance
  time — we don't have R2 credentials to test that path in every
  environment, and on-demand generation needs none. `Certificate.certificateUrl`
  is left `null`; revisit pre-rendering to R2 if certificates need to be
  emailed or cached.
- **Video embeds need no API keys**: `videoEmbedUrl` (`apps/web/src/lib/academy/video-embed.ts`)
  builds a plain iframe `src` from `Lesson.videoProvider`/`videoId` —
  `https://player.mux.com/{playbackId}` or `https://player.vimeo.com/video/{id}`.
  Both providers support this without any SDK or secret, which is why the
  lesson viewer's video rendering was fully testable live (a real Vimeo demo
  video is in the seed data) despite having no real Mux credentials either.
- **Course authoring is admin-only** (`/admin/courses`, `/admin/courses/[id]`):
  create a course, add modules, add lessons (all four `LessonType`s in one
  form — fields not relevant to the chosen type are simply ignored). Lesson
  downloads and quiz questions are pasted in directly (a download's R2/S3
  URL, a quiz's JSON question bank) rather than uploaded/built through a
  dedicated UI — consistent with `Quiz.questions` being "intentionally
  simple" per its schema comment, and with not having R2 credentials to
  build a real upload flow against yet.
- **Student-facing routes**: `/courses` (public catalog, published courses
  only) → `/courses/[slug]` (enroll/buy/subscribe CTA depending on
  `priceType` and current access) → `/portal/courses` (my enrolled courses +
  progress bars) → `/portal/courses/[id]` (module/lesson list, 🔒/▶️/✅ per
  lesson's access+progress state) → `/portal/courses/[id]/lessons/[lessonId]`
  (the actual viewer — video/text/downloads/quiz + "Mark complete").
- **Verified live**, not just unit-tested (`canAccessLesson`,
  `enrollment.ts`, `certificates.ts`, `progress.ts` each have their own
  `.test.ts` mocking `@platform/db`): a full browser walkthrough against
  real Postgres — free self-enroll, direct-URL access to a still-drip-locked
  lesson correctly blocked, backdating `Enrollment.enrolledAt` to prove the
  drip unlock math against real elapsed time (not mocked `Date.now()`), a
  quiz lesson gated on its prerequisite until that prerequisite was marked
  complete, auto-issued certificate downloaded as an actual `%PDF`-prefixed
  file once every lesson was done, membership self-enroll gated on a real
  `Subscription` row, and a genuinely HMAC-signed `customer.subscription.deleted`
  webhook event (same technique as Phase 3) actually revoking that
  membership course's access end to end.

## Website, portal & funnels (Phase 5)

- **Funnel builder is a structured block editor, not drag-and-drop.**
  `FunnelStep.content` stores an ordered array of typed blocks (`heading`,
  `text`, `image`, `button`, `form`, `buy` — `apps/web/src/lib/funnels/blocks.ts`).
  Admins add/reorder/remove blocks via plain forms at `/admin/funnels/[id]`
  (`lib/funnels/steps.ts`: `addBlock`/`moveBlock`/`removeBlock` rewrite the
  whole array — there's no per-block DB row). A real drag-and-drop canvas
  (ClickFunnels/OpenFunnels-class) was explicitly scoped out as its own
  multi-phase project, not something to build inside Phase 5.
- **Lead capture reuses the Phase 2 CRM pattern exactly**: `captureLead`
  (`lib/funnels/leads.ts`) upserts a `Contact`, logs the raw `FunnelSubmission`,
  and ensures exactly one `Deal` per contact per funnel (repeat opt-ins
  update the contact, never create a second deal) — all in one function,
  activity log included (`ActivityType.FUNNEL_SUBMISSION`, already modeled
  since Phase 1).
- **Cross-step lead identity is an explicit `?lead=<contactId>` query
  param, not a session cookie.** Phase 5 only needs to carry identity
  through explicit actions (a form submit, a button click) as a visitor
  moves forward through a funnel — it doesn't need anonymous pre-opt-in
  visit tracking, which is `FunnelVisit`'s job and stays deferred to
  Phase 6 alongside the analytics dashboard that would actually read it
  (this also sidesteps a real Next.js gotcha: middleware can set a cookie
  on a response, but the same request's Server Component render never sees
  it, since `Set-Cookie` only takes effect on the *next* request — not
  worth solving for data nothing reads yet).
- **Funnel checkout hands off to a new `/signup` page for anonymous
  visitors** — `Enrollment`/`Order` require a `User`, and there was no
  self-service registration before this phase (only admin-seeded logins).
  `funnelBuyAction` redirects to `/signup?productId=&funnelId=&lead=` when
  there's no session; `signupAction` (`apps/web/src/app/signup/actions.ts`)
  creates the account, links any existing `Contact` by email
  (`lib/auth/signup.ts`), signs in via the server-side `signIn` from
  `@/auth` (not `next-auth/react`, which is client-only), then — if a
  `productId` was carried along — goes straight to Stripe Checkout
  (reusing Phase 3's `createCheckoutSession`, looking up the `Deal` via
  `lead`+`funnelId`) instead of bouncing back through the funnel page.
  This is a real product tradeoff (account-creation friction vs. true
  guest checkout) made to reuse 100% of Phase 3's tested checkout path
  rather than build a second, guest-only one — revisit if conversion data
  ever justifies the guest-checkout path.
- **Marketing pages** live in the `(marketing)` route group (`apps/web/src/app/(marketing)/`)
  — a route group changes nothing about the URLs (`/`, `/courses`,
  `/courses/[slug]`, `/about`, `/pricing` are unchanged), it only lets
  these pages share one `layout.tsx` (nav + footer) without that nav
  leaking into funnel pages (`/f/...`, deliberately standalone/distraction-free,
  matching real funnel UX) or the app's role-gated sections. Copy is
  real-but-placeholder, on-theme for an intrapreneurship academy — swap it
  for actual brand copy whenever it's ready, no restructuring needed.
- **`/portal` finally has a nav layout** (`apps/web/src/app/portal/layout.tsx`),
  matching the pattern `/staff` and `/admin` already had since Phases 2–3.
- **Verified live**: `lib/funnels/leads.ts` and `steps.ts` have their own
  `.test.ts` files (mocked `@platform/db`, same pattern as every other
  phase), plus a full browser walkthrough against real Postgres — created
  a funnel and a block through the actual admin UI (not seed data),
  published it, and loaded the live page; ran the seeded 4-step funnel
  landing → opt-in → offer → (anonymous) buy click end to end, confirming
  the Contact/Deal/Activity rows it left behind in Postgres directly, not
  just the UI; followed the buy click through signup, confirming the User
  was created and the pre-existing funnel Contact got linked to it by
  email, with checkout itself stopping at the same "no synced Stripe
  price" `ValidationError` Phase 3/4 already established as the expected
  behavior without real Stripe keys in this environment.

## Automation & AI agents (Phase 6)

- **Sequences (email/SMS automation)**: `Sequence`/`SequenceStep`/`SequenceEnrollment` (already in
  the Phase 1 schema) are built out fully in Phase 6. `EmailProvider`/`SmsProvider`
  (`apps/worker/src/messaging/types.ts`) are small provider-agnostic interfaces; `ResendEmailProvider`/
  `TwilioSmsProvider` implement them, and `sendSequenceMessage` (`apps/worker/src/messaging/send.ts`)
  is the only thing sequence-processing code calls — it always writes a `MessageLog` row
  (`QUEUED` → `SENT`/`FAILED`) so a send attempt is recorded even if the provider throws.
  `sequenceStepId` on `sendSequenceMessage`'s input is optional (the DB column already was) so the
  same function also serves one-off, non-sequence sends (see "AI agents" below).
- **Enrollment/processing is two BullMQ queues, not one long-running job**: `enrollContactInSequence`
  (`apps/worker/src/sequences/enrollment.ts`) is idempotent (unique `sequenceId_contactId` key) and
  enqueues the first step's job; `processSequenceStepJob` (`apps/worker/src/queues/sequences.ts`)
  sends that one step's message, then either enqueues the next step's job (delayed by its
  `delayMinutes`) or marks the enrollment `COMPLETED` — the queue itself is the state machine.
  `processSequenceTriggerJob` (`apps/worker/src/queues/sequence-triggers.ts`) fans a funnel
  submission or an abandoned-checkout check out to every matching active `Sequence`. Both job
  processors are exported as standalone functions (not inlined in the `Worker` callback) so they're
  unit-testable without a real Redis connection — `createXWorker()` just wraps them in `new Worker(...)`.
- **Web-side code only ever produces onto these queues, never consumes**: `apps/web/src/lib/queues/*.ts`
  are thin lazy `Queue` wrappers (`enqueueFunnelSubmissionTrigger`, `enqueueAbandonedCheckoutCheck`,
  `enqueueLeadQualification`, `enqueueManualMessage`) — the worker owns every consumer. Enqueue calls
  that are a *side effect* of some other primary action (lead capture, checkout, contact creation)
  are wrapped in `.catch(error => console.warn(...))`, per the established pattern, so a stalled
  Redis/worker never breaks the user-facing action itself.
- **Admin UI** (`/admin/sequences`, `/admin/sequences/[id]`): create a sequence (name, trigger,
  optional funnel), activate/deactivate it, add ordered steps (channel, delay, subject, body) —
  `order` auto-assigned by counting siblings, same pattern as Modules/Lessons/FunnelSteps.
- **Funnel visit logging & analytics** (`FunnelVisit` was already in the Phase 1 schema, unused
  until now): every `/f/[funnelSlug]/[stepSlug]` page view is logged via `logFunnelVisit`
  (`apps/web/src/lib/funnels/analytics.ts`) — one row per view, no dedupe, same as a GA pageview.
  The anonymous per-visitor `sessionId` is a cookie (`fs_id`) set by `middleware.ts` for `/f/*`
  routes — critically, it's *also* forwarded via a request header (`x-fs-id`) using
  `NextResponse.next({ request: { headers } })`, because a cookie set in middleware isn't visible
  to that same request's Server Component render (`Set-Cookie` only takes effect on the browser's
  *next* request — this was flagged as a known gotcha back in Phase 5 and solved here exactly as
  planned then). `getFunnelAnalytics(funnelId)` computes, per step: total visits, unique visitors
  (distinct `sessionId`), submissions, and conversion-to-next-step (unique visitors who also
  visited the next step, divided by this step's unique visitors) — plus funnel-wide total leads
  and paid-order revenue. Rendered at `/admin/funnels/[id]/analytics`, linked from the funnel
  detail page. Fully testable without any external API keys, since it's pure internal DB
  aggregation — verified live with multiple simulated visitor sessions at different funnel depths
  against real Postgres, confirming the computed numbers matched the simulated drop-off exactly.
- **AI agents**: `runAgentWithTools({system, userMessage, history?, tools, executeTool, forceTool?,
  maxTurns?})` (`apps/web/src/lib/agents/run.ts`, duplicated with a factory-function client instead
  of a Proxy in `apps/worker/src/agents/run.ts` — the two apps share no code beyond `@platform/db`)
  is a minimal Anthropic Messages API tool-calling loop: send the conversation, execute any
  `tool_use` blocks, feed results back as `tool_result`, repeat until the model stops calling tools
  or `maxTurns` is hit. `forceTool` pins `tool_choice` on the first turn only, for agents whose job
  is "always call this one write tool once" rather than a free-form chat. `anthropic` (web) is a
  lazy `Proxy` singleton exactly like `lib/stripe.ts`, for the same reason (Next.js evaluates route
  modules during build-time page-data collection, before `.env` loads); `getAnthropicClient()`
  (worker) is a lazy memoized factory, matching the worker's existing messaging-provider pattern.
  `DEFAULT_AGENT_MODEL` reads `ANTHROPIC_MODEL` with a hardcoded fallback, overridable per call.
  Three of the four agents run **synchronously in the web process** (a Server Action calling
  Anthropic directly) rather than the worker — a deliberate deviation from the stack note that
  background work belongs in the worker, made because they're interactive/staff-or-student-facing
  and a queue+poll UX would be disproportionate for this phase. Only the lead-qualification agent,
  triggered automatically rather than by a human waiting on a response, runs as a true background
  job.
  - **Lead qualification** (worker, background): triggered from `createContact`
    (`apps/web/src/lib/crm/contacts.ts`) and `captureLead` (`apps/web/src/lib/funnels/leads.ts`) —
    the latter only for a *genuinely new* contact (checked via a `findUnique` before the upsert, not
    a timestamp heuristic), so a repeat funnel opt-in on the same email doesn't re-qualify every
    time. `qualifyLead` (`apps/worker/src/agents/lead-qualification.ts`) forces a single
    `record_qualification(score, summary, tags)` tool call, which merges an `aiQualification` object
    into `Contact.customFields` (`Json`), merges `tags` into `Contact.tags`, and logs a `SYSTEM`
    `Activity` — `describeActivity` renders that Activity's score/summary on the CRM timeline instead
    of a generic fallback.
  - **Follow-up drafting** (web, staff-triggered): a "Draft follow-up" button on
    `/staff/contacts/[id]` (`FollowUpDrafter` client component) calls a Server Action directly
    (not a `<form action>` — Server Actions support both invocation styles, and this one needs to
    return the draft for interactive review rather than redirect) to get a drafted subject/body from
    `draftFollowUpEmail` (`apps/web/src/lib/agents/follow-up.ts`), which forces a
    `save_draft_email(subject, body)` tool call. Nothing is persisted or sent at draft time — staff
    can edit the draft inline, and only clicking "Send" enqueues it via the new `manual-message`
    BullMQ queue (`apps/worker/src/queues/manual-message.ts`), which calls the same
    `sendSequenceMessage` sequences use (with no `sequenceStepId`) and additionally logs an
    `EMAIL_SENT`/`SMS_SENT` Activity — unlike automated sequence sends, a staff-initiated manual
    send is timeline-worthy. Unlike the other agents' best-effort `.catch`-wrapped enqueues, the
    send action's enqueue call is *the* requested action here, not a side effect, so its failure is
    allowed to surface to the UI rather than being swallowed.
  - **Student support chat** (web, portal): a simple chat widget (`LessonChat`) on the lesson
    viewer page, scoped to the current course. `askStudentSupport` (`apps/web/src/lib/agents/
    student-support.ts`) is the one agent that's a genuine multi-turn *conversation* (not just a
    multi-turn tool loop within one call) — the client keeps prior turns as plain `{role, content}`
    text pairs and passes them as `history` on each new question, which `runAgentWithTools` prepends
    before the new `userMessage`. Its one read tool, `search_course_content(query)`, does a plain
    case-insensitive substring search over the current course's `Lesson.title`/`content` —
    deliberately no vector search/embeddings for this phase. The Server Action
    (`.../lessons/[lessonId]/chat-actions.ts`) re-derives `courseId` from the lesson server-side via
    `canAccessLesson`, rather than trusting a client-supplied course id, so a student's chat can only
    ever search content from a course they're actually enrolled in and have access to.
  - **Funnel optimizer** (web, admin): a "Get AI suggestions" button on
    `/admin/funnels/[id]/analytics` (`OptimizerAdvice`) calls `getFunnelOptimizationAdvice`
    (`apps/web/src/lib/agents/funnel-optimizer.ts`), which offers one read-only tool,
    `get_funnel_analytics()` (backed by the same `getFunnelAnalytics` from the visit-logging work
    above) — no write tool, since this agent is advisory-only and can't change the funnel itself.
  - **Testing without a real Anthropic key**: this environment has no real `ANTHROPIC_API_KEY`
    (only a placeholder), so `runAgentWithTools` and all four agents' business logic (tool
    selection, forced-tool handling, DB writes from tool results, history threading) are unit-tested
    with a fully mocked Anthropic client — but every agent's UI path was *also* verified live end to
    end (real contact creation → real BullMQ job → real worker pickup → real HTTPS call to
    Anthropic's API), each producing a genuine `401 invalid API key` response from Anthropic's own
    servers rather than a mock. That's a stronger signal than it sounds: it proves the entire
    request pipeline — client construction, system/tools/messages/tool_choice serialization, queue
    routing, and the UI's error handling — is wired correctly all the way to Anthropic's auth layer,
    with only the final completion blocked by the missing key. Same accepted pattern as Stripe/
    Resend/Twilio in every prior phase.

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
