# Architecture Decision Records

## ADR-001 — Modular Next.js monolith on PostgreSQL (accepted)
One deployable with clear module boundaries (`server/`, `modules/`, `integrations/`). No microservices, no graph database: typed `relations` in Postgres with endpoint indexes cover the Evidence Graph at student-team scale.

## ADR-002 — Cookie sessions with scrypt instead of a hosted auth provider (accepted)
The sandbox has no external auth service. Sessions are server-side rows with httpOnly cookies; passwords use Node `scrypt`. The boundary (`src/server/auth.ts`) is small enough to swap for Supabase Auth / SSO later without touching pages.

## ADR-003 — Application-layer tenancy now, RLS later (accepted)
All queries derive `team_id` from verified membership; media/export routes join memberships. Postgres RLS keyed on `set_config('app.team_id')` is planned once a per-request DB role is available. DB tests guard the current invariant.

## ADR-004 — Policy as versioned data, evaluated server-side (accepted)
Competition rules change every season and differ by program. A pure evaluator over `policy_versions.action_matrix` with fail-safe defaults (UNKNOWN → REQUIRE_REVIEW) keeps UI free of rule logic and makes exports pinnable and auditable.

## ADR-005 — Deterministic core, optional AI (accepted)
Why?, Ask History, clustering and structural checks are deterministic. AI is a provider adapter behind the policy gate, producing separately-stored, labelled artifacts. This satisfies strict competition modes and keeps student ownership intact.

## ADR-006 — Outbox-first capture (accepted)
Captures are written to IndexedDB before any network call and synced with stable `client_id`s; the server deduplicates. Original local timestamps are preserved as `occurred_at`.

## ADR-007 — Local-disk storage adapter (accepted, provisional)
Private media uses a `StorageAdapter` interface with a disk implementation for this environment. Production multi-instance deployments should provide an S3/Supabase implementation; routes and authorization are unchanged.

## ADR-008 — Failures derived, not duplicated (accepted)
A failure is an iteration outcome (rejected/reverted) or a test outcome (fail). The Failure Library queries these rather than maintaining a parallel entity, avoiding drift.
