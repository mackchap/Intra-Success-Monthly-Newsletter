# PRD — Intra Success Academy

This is the product requirements doc for the business platform described in
`CLAUDE.md` (marketing site + portal, CRM, funnels, academy, payments, AI
agents). `CLAUDE.md` is the source of truth for stack/conventions/how-to-run;
this file tracks product scope per phase and — per request — a research pass
on existing open-source code we can learn from or borrow patterns/packages
from as each phase is built.

## Scope by phase

See `CLAUDE.md`'s phased build plan table for the authoritative status. In
short: Phase 1 (scaffold/auth/schema/deploy) is done; Phases 2–6 (CRM core,
Stripe, Academy, Website/Portal/Funnels, Automation+Agents+Analytics) are not
started. Requirements for each phase will be fleshed out here as that phase
starts.

## Research: existing open-source libraries & reference implementations

Goal: before building each subsystem from scratch, know what already exists
— either as a library we could actually depend on, or as a reference
implementation whose data model / API design is worth reading before writing
ours. None of these are wired into the codebase; this is due-diligence, not
a dependency list. Findings below are from a live search (Sept 2026), not
memory — verify current stars/license/activity before depending on anything.

### 1. CRM (contacts, companies, deals/pipeline)

| Project | Language | Notes | Relevance to us |
|---|---|---|---|
| [Twenty](https://github.com/twentyhq) ([twenty.com/product](https://twenty.com/product)) | TypeScript | The leading open-source CRM, ~45k GitHub stars, AGPL-3.0, YC-backed. Stores contacts/companies/deals with customizable Kanban pipelines, a workflow engine (triggers/actions/conditions), and an API-first design. | **Best reference for our schema/UI.** Same language as our stack. Worth reading their data model (Person/Company/Opportunity + custom objects) and workflow-engine design before we build Phase 2's pipeline UI and Phase 6's automation engine. Too heavy/opinionated to depend on directly given we need CRM data to live in the *same* Postgres as Academy/Funnels/Orders. |
| [Frappe CRM](https://github.com/frappe/crm) (frappe.io/crm) | Python (Frappe framework) + Vue frontend | ~3.3k stars. Kanban pipelines, Twilio calling, WhatsApp messaging, pluggable Python automation scripts, ERPNext integration. | Reference only — different framework/ORM (Frappe, not Django/Prisma). Worth a look for how they model lead→deal conversion and call/WhatsApp activity logging, since our `Activity` timeline needs the same shape. |
| [django-crm / SuiteCRM / EspoCRM](https://github.com/topics/open-source-crm) | Python / PHP | Older, more enterprise-oriented open-source CRMs. | Lower priority — mature but heavier, different stack. Skim only if Twenty's model doesn't answer a specific question. |

### 2. Funnels, landing pages, lead capture

| Project | Language | Notes | Relevance to us |
|---|---|---|---|
| [OpenFunnels](https://github.com/aialvi/openfunnels) | TypeScript | Open-source funnel builder + "CRM-lite": drag-and-drop page editor, starter templates, custom domains, lead-capture forms, contact records, attribution analytics, A/B experiments. Directly the closest existing analog to our Phase 5 funnel builder. | **Read closely before Phase 5.** Same problem (funnel stages → pages → lead capture → CRM record) in the same language. Good source for the page-builder JSON shape and attribution/analytics event model — compare against our `FunnelStep.content: Json` and `FunnelVisit`/`FunnelSubmission` tables. |
| [Autonnel](https://autonnel.com/) | — | Open-source funnel builder for e-commerce (landing/checkout/upsell pages), integrates with Shopify/WooCommerce or their own "Picocart". | Reference for checkout→upsell page sequencing, which maps to our `FunnelStepType.CHECKOUT`/`UPSELL`. |
| [Mautic](https://github.com/mautic/mautic) | PHP | The largest open-source marketing-automation project (~7k+ stars, 134 repos). Visual campaign builder: multi-step workflows, branching/delays/conditions, triggers on form submission/page visit/email engagement, email + SMS + push. | **Best reference for Phase 6's automation sequences.** Its campaign-builder data model (triggers, decisions, time delays, branches) is the mature version of our `Sequence`/`SequenceStep`/`SequenceEnrollment` tables. Different language (PHP/Symfony) so not a dependency candidate, but worth reading their campaign event schema before extending ours beyond linear sequences. |

### 3. Academy / LMS (courses, modules, lessons, drip, certificates)

| Project | Language | Notes | Relevance to us |
|---|---|---|---|
| [Open edX](https://github.com/openedx/openedx-platform) | Python (Django) | The reference LMS at scale — powers edX, MIT, Harvard courses. Full course authoring + delivery, cohorts, certificates, deep feature set. | Reference for the *hard parts*: certificate issuance rules, drip/prerequisite logic, grading. Far too large to adopt (it's a full platform, not a library) but a good source of truth for edge cases (e.g. what happens to progress when a prerequisite course is later added). |
| [Frappe LMS](https://github.com/frappe/lms) | Python (Frappe) | 100% open-source LMS with a 3-level hierarchy: courses → chapters → lessons — the same shape as our `Course → Module → Lesson`. | Good sanity check that our 3-level model matches an established design. |
| [LearnHouse](https://github.com/learnhouse/learnhouse) | Python (FastAPI/SQLModel/Alembic backend) + Next.js/React frontend | Modern open-source learning platform; closest to our stack (Next.js frontend, Postgres-friendly backend via SQLModel). | **Good architecture reference for Phase 4.** Worth comparing their FastAPI resource layout (courses/chapters/activities) against our planned API routes, even though we won't share code (different backend language). |
| [CourseLit](https://prompts.brightcoding.dev/blog/courselit-the-open-source-lms-revolution) | Node.js | LMS with drip content, progress tracking, Stripe payments, cloud storage (MediaLit) for video/downloads. | Closest-language reference (Node) for drip scheduling + Stripe-gated access, i.e. exactly our Phase 4 access-control problem. |

### 4. Stripe integration patterns

| Project | Language | Notes | Relevance to us |
|---|---|---|---|
| [vercel/nextjs-subscription-payments](https://github.com/vercel/nextjs-subscription-payments) | TypeScript / Next.js | Vercel's reference Next.js + Stripe + Supabase subscription app. Webhook listens for Stripe product/price updates and syncs them into the app DB. | **Primary reference for Phase 3.** Same framework. Read their webhook handler for the canonical event-to-DB-sync pattern (`product.created`, `price.updated`, `customer.subscription.updated`, etc.) before writing ours against `Product`/`Subscription`/`WebhookEvent`. |
| [nextjs/saas-starter](https://github.com/nextjs/saas-starter) | TypeScript / Next.js | Official Next.js team starter: Postgres + Stripe + shadcn/ui, minimal and current. | Good current-idioms reference (App Router route handlers for checkout + webhook) — lighter weight than Vercel's older template. |
| [dj-stripe](https://github.com/dj-stripe/dj-stripe) | Python (Django) | Syncs all Stripe objects into local Django models automatically via webhooks, so app code queries Stripe data through the ORM instead of the Stripe API. | Not directly portable (Django-specific), but the *idea* — mirror every relevant Stripe object into our own tables via webhook rather than calling the Stripe API on every read — is exactly what our `Product`/`Order`/`Subscription`/`WebhookEvent` tables are already designed for. Validates that approach. |

### 5. AI agents / tool-calling (Phase 6)

| Project | Language | Notes | Relevance to us |
|---|---|---|---|
| [anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks) | Python (notebooks) | Anthropic's official example repo: tool use, agents, MCP, RAG, extended thinking, prompt caching. ~44k stars. | **Primary reference for every Phase 6 agent** (lead-qualification, follow-up, student-support, funnel-optimizer). Even though our agents will be called from our Node/TypeScript worker (via the Anthropic TypeScript SDK, not Python), the tool-use and multi-step agent-loop patterns here translate directly. |
| [anthropics/claude-agent-sdk-python](https://github.com/anthropics/claude-agent-sdk-python) | Python | Anthropic's Agent SDK — custom tools as Python functions exposed to Claude as in-process MCP servers, plus hooks and sandboxed execution. | Python-only today; our agents will be plain Anthropic SDK tool-calling loops in the worker rather than this SDK, but its "tools as typed functions" pattern is worth mirroring in our own tool definitions (CRM read/write, academy read/write). |
| [Model Context Protocol (MCP) HubSpot servers](https://github.com/baryhuang/mcp-hubspot), [axonops/hubspot-mcp](https://github.com/axonops/hubspot-mcp) | Python/TypeScript (various) | Community MCP servers exposing a CRM's contacts/companies/deals as tools an LLM can call. | Directly relevant shape for our own "CRM tools" the lead-qualification/follow-up agents will need (get_contact, update_deal_stage, create_task, etc.) — whether we expose them as an in-process MCP server or plain function-calling tools, these repos show the tool surface a CRM-aware agent needs. |
| [LangGraph](https://github.com/langchain-ai/langgraph) / [CrewAI](https://github.com/crewAIInc/crewAI) | Python | Leading Python multi-agent orchestration frameworks (state-machine and role-based respectively) as of 2026. | Not needed for Phase 6 as scoped (four fairly independent single-purpose agents, not a multi-agent crew) — but if agent-to-agent handoff is added later (e.g. lead-qualification agent handing to follow-up agent), these are the frameworks to evaluate first. Would require a Python service alongside the Node worker, which is a real architectural cost to weigh against just chaining tool-calling loops ourselves in TypeScript. |

### 6. Background job queues (context for our BullMQ choice)

| Project | Language | Notes | Relevance to us |
|---|---|---|---|
| [RQ (Redis Queue)](https://github.com/rq/rq) | Python | Simple Redis-backed job queue, explicitly a lighter alternative to Celery. | Not applicable — our worker is Node/BullMQ per `CLAUDE.md`. Included because it was asked for and because RQ's "just a function + `queue.enqueue()`" simplicity is a good bar to compare our own queue job ergonomics against when Phase 6 adds real jobs (sequence sends, drip releases, agent runs). |
| Celery | Python | The standard Python distributed task queue (Redis/RabbitMQ broker). | Same as above — not applicable to our Node stack, noted only as the Python-world equivalent of BullMQ for comparison purposes. |

### 7. Certificates (Phase 4 completion certificates)

| Project | Language | Notes | Relevance to us |
|---|---|---|---|
| ReportLab | Python | The standard Python PDF-generation library; commonly used for certificate generation. | Not directly usable from our Node stack. If certificate generation ends up needing a dedicated PDF pipeline, the Node equivalents to evaluate are `pdf-lib` or `@react-pdf/renderer` (HTML/React → PDF), following the same "template + fill in student/course/date" pattern these Python examples use. |
| Various GitHub "[certificate-generator](https://github.com/topics/certificate-generator)" projects (Node + Python) | Node / Python | Small reference apps: store student + course, generate a PDF certificate, store it (several use cloud storage links, matching our R2-based, no-local-storage rule). | Low individual value (mostly toy projects) but collectively confirm the pattern our schema already supports: `Certificate.certificateUrl` pointing at an R2-hosted PDF generated at issuance time, not stored locally. |

### How to use this section going forward

Update the relevant row(s) when a phase starts, noting what (if anything)
was actually borrowed — a data-model idea, an API shape, a specific package
— and what was deliberately not reused and why. Don't let this table go
stale: a link with no "what we did with it" note isn't useful six months in.
