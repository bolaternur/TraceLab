# Architecture

## Principles as invariants
1. Student thinking stays student-owned: `annotations.provenance` distinguishes `student | source | system | suggestion | ai`; AI output is a separate row, never an overwrite.
2. Original evidence is immutable: `source_events` are append-only (only triage columns `status`, `iteration_id`, `subsystem_id`, `visibility` change). Corrections are new annotation versions (`supersedes_id`).
3. Private by default: every team-scoped read/write passes `requireTeam()` / `requireTeamById()` (membership verified per request). Media and exports are served through membership-joined queries; 404 for both "missing" and "not yours".
4. Competition policy is data: `competition_profiles` + `policy_versions.action_matrix`, evaluated by the pure `evaluatePolicy()` and the server gate `gate()`.
5. AI is optional: the Evidence Core (capture, inbox, graph, Why?, exports) never calls a model.

## Request flow
```
UI (server components / client forms)
  → server action (src/server/actions.ts): authorize → zod validate → domain logic → audit/track → revalidate
  → queries (src/server/evidence.ts) always filtered by team_id
```
Webhooks: `POST /api/webhooks/{provider}/{connectionId}` → verify signature/secret → idempotency (`webhook_deliveries`) → normalizer (`src/integrations/normalize.ts`) → `source_events` (unique on team+provider+provider_event_id) → artifacts.

Offline capture: client writes to IndexedDB outbox first → `POST /api/sync` (idempotent on `client_id`) → `persistCapture()` (same code path as online capture).

## Modules
- `modules/policies/engine.ts` — action registry, decisions, evaluator, seeded policy baseline (snapshot 2026-09-03).
- `modules/ai/provider.ts` — `AiProvider` interface; `disabled`, `deterministic-fake`, `openai-compatible`.
- `modules/billing/entitlements.ts` — plan table and entitlement checks; privacy/export/competition safety are never gated.
- `server/policy.ts` — loads governing version (active, else pending), gates, logs to `ai_action_logs`.
- `server/storage.ts` — `StorageAdapter` (local disk), content sniffing, JPEG metadata stripping, AES-GCM secret encryption.
- `server/audit.ts` — audit events, analytics (IDs only), notifications, DB job queue, structured logging.

## Background jobs
`jobs` table claimed with `FOR UPDATE SKIP LOCKED` by `POST /api/jobs/run` (cron + `CRON_SECRET`). Kinds: `storage.cleanup`, `notify.tests_without_decisions`, `retention.apply`. Exponential backoff, max 5 attempts, failures visible in the table.

## Deferred by design
- Row-level security: authorization is enforced in the application layer with a single pooled DB role. RLS policies keyed on `set_config('app.team_id')` are a straightforward addition once a per-request role is available (ADR-003).
- Vector search: `feature_flags.semantic_search` reserved; text search is authoritative.
