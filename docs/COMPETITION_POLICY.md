# Competition policy engine

Research snapshot: **2026-09-03**. No official certification is claimed for any program.

## Model
- `CompetitionProfile` (key, program, strict) → many `PolicyVersion`s.
- A version has `status` (draft | active | superseded | needs_review), effective date, review metadata, official source URLs, changelog, `constraints` (e.g. page/file limits) and an `action_matrix` mapping each registered action to a decision.
- Decisions: `ALLOW`, `ALLOW_WITH_DISCLOSURE`, `BLOCK`, `REQUIRE_REVIEW`, `UNKNOWN`.
- Action registry: `src/modules/policies/engine.ts` (`POLICY_ACTIONS`).

## Evaluation (server-side, `gate()`)
1. `coach_edit_student_content` → BLOCK always.
2. Core deterministic actions (search/retrieve evidence, structural gaps, exact transcription, deterministic notebook export) → ALLOW always.
3. Student-Owned Mode + strict profile → BLOCK for every generative action.
4. No profile / no version → REQUIRE_REVIEW.
5. Version `needs_review` / `draft` / `superseded` → REQUIRE_REVIEW (explicit BLOCK entries still block).
6. Active version → matrix value; missing/UNKNOWN → REQUIRE_REVIEW; Student-Owned Mode downgrades ALLOW → ALLOW_WITH_DISCLOSURE for generative actions.

## Seeded baseline
| Profile | Version | Status | Summary |
| --- | --- | --- | --- |
| `vex_strict` | 2026.1 | active | RECF Student-Centered Policy: generative notebook manipulation BLOCKED; retrieval allowed; memory answers with disclosure. |
| `ftc_2025_26` | 2025.26 | superseded | Archived DECODE season: cover + 15 pages, file limits, minimize PII, no external links followed, AI composition allowed with credit. |
| `ftc_2026_27` | 2026.27-pending | needs_review | BIOBUZZ launches 2026-09-12; rules NOT entered. Risky actions UNKNOWN → REQUIRE_REVIEW. |
| `isef_2027` | 2027.draft | draft | Protected outputs blocked; retrieval with citation; approval/safety workflows are external. |
| `generic` | 1.0 | active | ALLOW_WITH_DISCLOSURE; reflections never generated. |

## Updating rules
Coaches / org admins use the Policy Update Center (`/app/competition`) to record a new immutable version with sources and changelog. Activating supersedes the previous active version. Exports store `policy_version_id` and stay pinned. Add regression cases to `tests/policy.test.ts` for every new version.
