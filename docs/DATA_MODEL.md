# Data model

Authoritative schema: `src/db/schema.ts`; SQL in `drizzle/`.

## Tenancy
`organizations` ⟵ `organization_memberships` (admin | coach | member) · `teams.organization_id` nullable · `team_memberships` (student | student_lead | coach; status active | alumni | removed) · `team_invites` (code, role, max_uses, expires_at, revoked_at).

## Engineering structure
`seasons` (per team, `is_active`, handoff state) → `projects` → `subsystems` (self-referencing `parent_id`).

## Evidence
- `source_connections` — provider, encrypted secret, health.
- `source_events` — append-only; `provider_event_id` unique per team+provider; `client_id` unique (offline idempotency); `content_hash`; `visibility` (team | sensitive); triage `status` (inbox | linked | ignored).
- `artifacts` — commit | cad_revision | photo | video | drawing | csv | test_file | document; `storage_key` for private media or `external_reference`.
- `annotations` — `entity_type/entity_id/field`, `provenance`, `source_method`, `supersedes_id` version chain.
- `iterations` — state open | testing | deciding | closed; outcome kept | reverted | rejected | deferred.
- `tests` — target, question, hypothesis, procedure, independent variable, metric/units, trials/successes or value, pass criteria, environment, observations, outcome pass | fail | inconclusive | qualitative.
- `decisions` — disposition keep | revert | iterate | defer | reject | unknown; status open | closed | reversed; alternatives JSON.
- `relations` — typed edges `RESPONDS_TO IMPLEMENTS MODIFIES TESTS SUPPORTS CONTRADICTS SUPERSEDES DERIVED_FROM CONTRIBUTED_BY LEADS_TO REFERENCES RELATED_TO`; `origin` student | system | suggestion | ai; `status` accepted | suggested | rejected. Unique on (from, to, type).

Failures are derived: iterations with outcome rejected/reverted and tests with outcome fail (queried by the Failure Library).

## Policy & AI
`competition_profiles` (key, program, strict) → `policy_versions` (version, status draft | active | superseded | needs_review, effective_from, reviewed_at, reviewer, source_urls, constraints, action_matrix). `ai_action_logs` (action, policy_version_id, decision, referenced entities, provider/model, output hash, disposition).

## Operations
`exports` (type, version, policy_version_id, manifest with source/student/generated IDs, hash, storage_key) · `audit_events` · `notifications` · `jobs` · `webhook_deliveries` · `subscriptions` · `analytics_events` · `feature_flags` · `sessions`.

## Indexes
Team+time on events/tests/decisions/iterations; provider event uniqueness; client_id uniqueness; artifact sha256; relation endpoints; membership uniqueness; policy status; job status/run_after.
