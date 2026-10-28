# TraceLab — Build. Test. Decide. Remember.

TraceLab connects code, CAD, photos, tests and student reasoning into a traceable
engineering history. It preserves evidence provenance and student authorship.

**Current state: demonstration MVP, not production-ready.**
See [PRODUCT_CAPABILITIES.md](PRODUCT_CAPABILITIES.md) for the capability matrix,
known problems, test results and three-minute judge demonstration.

## Implemented and partial capabilities

Real evidence records, annotations, iterations, tests, decisions and relations;
password authentication and membership checks; Capture and IndexedDB outbox;
graph, timeline, search, handoff and private 3D viewing.
Models are imported with administrator scripts, not a browser upload flow.
Exports are HTML/JSON with provenance; PDF is not implemented.
GitHub supports push webhooks. Onshape needs OAuth credentials and a webhook,
Discord needs a relay, and AI is disabled by default.

Full localization, account verification/recovery, rate limiting, session management,
object storage, complete pagination, PDF and browser E2E remain unfinished.
Capture needs atomic writes; HTML exports currently take at most 500 source events.
Demo numbers are not measured research results.

The target product is universally free. Legacy pricing/server code remains until
the coordinated removal and archival migration are approved.
Draft migration 0004 is not registered or applied; see
[the procedure](docs/FREE_MODE_MIGRATION.md).

## Local setup

Use Node 22+ and PostgreSQL. Copy .env.example to .env; configure DATABASE_URL
and a random SECRETS_ENCRYPTION_KEY of at least 32 characters. Never commit secrets.

```sh
npm ci
npm run db:migrate
npm run dev
```

Config-based Drizzle validation currently fails on this host; resolve it before
migration execution. Do not use db:push as a production workaround.
Only in an isolated demo database, run npm run db:seed. It creates fictional Orion
records and demo users. Password demo1234: lead@trace.demo and coach@trace.demo.
Do not seed a real workspace. DEV_AUTH_BYPASS must stay false in production.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run frontend:verify
npm run i18n:audit
npm run build
```

Set DATABASE_URL in the process before Vitest to include database suites.
For local settings: node --env-file=.env node_modules/vitest/vitest.mjs run.
The default command otherwise excludes two files.
i18n:audit currently fails on remaining literal JSX strings; it is a lower-bound
inventory, not complete translation coverage. Full browser E2E is not implemented.

## Deployment

Use PostgreSQL, HTTPS, a Node runtime, a real encryption key and CRON_SECRET.
Build with npm run build, serve with npm start. Keep DEV_AUTH_BYPASS=false.
Current storage requires a durable private disk shared with the application;
ephemeral/serverless filesystem deployment is not supported.
S3/Supabase integration still needs implementation.

Schedule POST /api/jobs/run with Authorization: Bearer CRON_SECRET.
GET /api/health checks database connectivity only, not full readiness or worker health.
Back up PostgreSQL and private storage together and rehearse an isolated restore
before using real team data. Current production build success does not verify these services.

## Architecture

Next.js 16 App Router, React, PostgreSQL/Drizzle, Three.js and React Flow.
src/server contains auth, actions, evidence, storage and policy gates;
src/db defines the schema; drizzle contains migration history.
Read AGENTS.md and installed Next.js docs before framework changes.
See docs/SECURITY.md and [dependency review](docs/DEPENDENCY_REVIEW.md).
