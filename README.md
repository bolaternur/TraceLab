# TraceLab

TraceLab connects sources, engineering tests, decisions and student-authored explanations. All features in the active application are free; capacity and safety limits apply equally to every team.

**Development implementation, not a verified public beta.** Fictional demonstration records are never research results. The complete 2026-10-26 requirements, implementation evidence and unresolved gates are tracked in [docs/IMPLEMENTATION_MATRIX.md](docs/IMPLEMENTATION_MATRIX.md).

## One application and one startup

The supported application is the root Next.js project. The Astra presentation, accounts, team onboarding, workspace and private APIs run on the same origin. `/workspace` uses PostgreSQL. `/demo/workspace` preserves the browser-local demonstration and its existing storage format. Older `/app` links redirect to the new workspace. The separate static build is a reference/demo build, not the production backend.

```sh
npm ci
npm run db:migrate
npm run dev
```

Open http://localhost:3000. `predev` prepares the static presentation assets; restart the command after editing `website/tracelab` files. The same preparation runs before `npm run build`. Production uses `npm run build` then `npm start` with a persistent Node process and private storage.

## Local database and configuration

Copy `.env.example` to **`.env.local`** and use your own values. Never commit `.env.local`. `DATABASE_URL` must use a restricted runtime role that neither owns the tables nor has `SUPERUSER`/`BYPASSRLS`. `DATABASE_MIGRATION_URL` is the separate migration owner. Do not run migrations with the runtime role or use `db:push` as a substitute for registered migrations.

On this owner's computer the current checkout is `C:/Users/User/projects/TraceLab-web`, outside OneDrive. Its new isolated database is `tracelab_unified_dev_20261026`; previous databases and browser projects were not imported or replaced. Do not run `db:seed` against a personal/team database. Create an account, verify its email, then create an empty team and project.

The optional `scripts/setup-unified-local.mjs --admin-env=<existing-local-env>` creates a **new** local database and restricted role, refusing to overwrite existing targets. It does not migrate the old application data. Migration history is checked with `node scripts/check-migrations.mjs`.

## Email and files

Development uses `MAIL_TRANSPORT=local` and `MAIL_PREVIEW_ENABLED=true`. Local account pages show a browser-scoped test mailbox; no external email is sent. Preview is denied in production and for remote requests. For a real deployment, follow [Resend setup](docs/account-mail-setup.md).

Private media defaults to `STORAGE_PROVIDER=local` and `.data/storage`. A Supabase adapter is available with an explicitly **private** bucket; see [external-service setup](docs/EXTERNAL_SERVICES.md). Do not put a service-role key in client code. An ephemeral filesystem is not suitable for real team files.

Before inviting real teams over the internet, follow [the pilot launch runbook](docs/PILOT_LAUNCH.md). `node scripts/pilot-preflight.mjs` checks production settings without sending mail or files; add `--check-db` for a read-only runtime-role/schema check. Passing configuration checks does not replace actual delivery, storage and two-account acceptance tests. GitHub Pages hosts only the static demonstration, not this shared application.

## Verification

```sh
npm run typecheck -- --incremental false
npm test
npm run test:static
node --test tests/pilot-preflight.node.test.mjs
node --test website/tracelab/workspace-outbox.test.mjs website/tracelab/workspace-server.test.mjs
npm run build
node scripts/verify-production-origin.mjs
```

Database integration suites require `.env.local` with the isolated database and explicit opt-in flags documented in their files. They create randomized fixtures and clean only their own fixtures. The old Orion-seeded integration suites are separate legacy tests; do not seed a real team merely to satisfy them. No unit-test count implies that every browser flow, live provider or pilot gate is verified.

`npm run test:db` enables the current unified DB suites together and refuses database names outside the dedicated `tracelab_unified_*` development/test family. CI uses this command on a fresh migrated database instead of schema push or fictional seed data.

## Data integrity and recovery

Original source records and artifact metadata are immutable. Author edits append versions. Shared mutations check membership, revision and request identity; layout is stored separately. Team import requires a preview bound to the exact payload and team, then explicit confirmation, and creates a separate project. Browser originals remain available.

`node scripts/verify-local-backup.mjs` dumps the isolated local database, restores it into a unique temporary verification database, compares core table counts and retains the dump under ignored `.data/backups`. **Files require a separate backup** of `.data/storage` or the configured bucket. Store a complete database+files backup before a real deployment or migration.

## Scope and remaining gates

See [PRODUCT_CAPABILITIES.md](PRODUCT_CAPABILITIES.md), the [implementation matrix](docs/IMPLEMENTATION_MATRIX.md) and [user guide](docs/USER_GUIDE.md). The development flows do not establish legal compliance, competition eligibility, long-term reliability or pilot outcomes. Public beta requires real team trials, current policy/privacy reviews, recovery/load/accessibility checks and actual provider configuration. No awards or research benefits are guaranteed.

The earlier README and capability audit are retained in `docs/archive/` as historical evidence. They are not the current startup instructions. Legacy billing rows are retained for history; payment webhooks and plan changes cannot grant or remove feature access. Draft migration 0004 is not silently inserted into the applied history.
