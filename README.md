# TraceLab — *Build. Test. Decide. Remember.*

Evidence infrastructure for student engineering teams. Code, CAD, photos, tests and student reasoning become a single source-linked history: notebook, portfolio, season handoff, engineering memory, contribution evidence and coach insight.

> Competition-facing product name: **TraceLab**. Branding is centralised in `src/lib/brand.ts`. Commercial launch still requires independent trademark/domain clearance.

## What is implemented

| Area | Status |
| --- | --- |
| Auth (scrypt passwords, httpOnly sessions), teams, organizations, roles, invites | ✅ |
| Seasons, projects, hierarchical subsystems | ✅ |
| Append-only source events, artifacts, versioned student annotations, iterations, tests, decisions, typed relations | ✅ |
| Quick Capture (photo/problem/test/decision/reflection), offline IndexedDB outbox, idempotent sync, EXIF/GPS stripping | ✅ |
| This Week, Evidence Inbox (batch triage, deterministic clusters), Iteration workspace, Tests (before/after comparison), Decisions (structural filters) | ✅ |
| Evidence Graph (SVG + list alternative), Time Machine, Why?, Failure Library, Search, "We already tried this" | ✅ |
| Season Handoff, Contribution Map / Skill Passport, Coach Dashboard, Organization Dashboard, Notifications, Settings | ✅ |
| Competition policy engine (versioned data, server-side gate), Student-Owned Mode, Policy Update Center, AI action log | ✅ |
| Provenance-preserving exports (VEX notebook, FTC composer, handoff, personal, team) pinned to policy versions | ✅ |
| GitHub / Telegram / Discord / Onshape webhook ingestion (signature verification, idempotency), Onshape OAuth, CSV import | ✅ code-complete; live use requires provider credentials |
| AI provider abstraction (disabled / deterministic fake / OpenAI-compatible) | ✅ |
| Billing adapter (Stripe-compatible webhook → entitlements), plans, dev adapter | ✅ code-complete; live use requires keys |
| DB-backed job runner, audit events, product analytics (IDs only), structured logs | ✅ |
| Tests: policy regression, integrations, storage/privacy, DB tenant isolation | ✅ |

## Quick start

```bash
cp .env.example .env            # set DATABASE_URL, SECRETS_ENCRYPTION_KEY
npm install
npm run db:push                 # or: npm run db:migrate (uses drizzle/*.sql)
npm run db:seed                 # demo season "Orion" + policies
npm run dev
```

Demo accounts (password `demo1234`): `lead@trace.demo` (student lead), `anim@`, `dana@` (students), `coach@trace.demo` (coach + org admin), `other@trace.demo` (isolated second team).

## Scripts

`dev` · `build` · `start` · `lint` · `typecheck` · `test` (vitest) · `db:push` · `db:generate` · `db:migrate` · `db:seed`

## Architecture (short)

Modular Next.js 16 (App Router) monolith on PostgreSQL via Drizzle:

```
src/app          routes (public site, /auth, /onboarding, /app workspace, /api)
src/server       auth & tenancy gate, actions (mutations), evidence queries, policy gate, storage, audit
src/modules      policies/engine (pure), ai/provider, billing/entitlements
src/integrations normalizers + signature verification for GitHub/Onshape/Telegram/Discord/Stripe
src/lib          brand, i18n (en/ru/kk), outbox (IndexedDB), csv, time
src/db           schema, seed; drizzle/ holds SQL migrations
tests/           vitest suites; docs/ holds engineering docs and ADRs
```

See `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `docs/PRIVACY.md`, `docs/COMPETITION_POLICY.md`, `docs/AI_POLICY.md`, `docs/INTEGRATIONS.md`, `docs/adr/`.

## Deployment

Any Node 22 host (Vercel, Fly, Render, a VM) + managed Postgres. Steps: set env from `.env.example` → `npm run db:migrate` → `npm run build` → `npm start`. Schedule `POST /api/jobs/run` (Bearer `CRON_SECRET`) every minute. Health: `GET /api/health`. For durable media in multi-instance deployments, implement the `StorageAdapter` in `src/server/storage.ts` against S3/Supabase Storage (local disk is the default adapter).

## CI

`.github/workflows/ci.yml`: install → lint → typecheck → schema push → seed → tests → build → secret scan.

## E2E smoke script

With the production server running and a valid session id in `E2E_SESSION` (row in `sessions`), `npx tsx scripts/e2e-webhook.mts` exercises: signed GitHub webhook ingestion, replay deduplication, signature rejection, offline-sync idempotency and cross-team sync denial.
