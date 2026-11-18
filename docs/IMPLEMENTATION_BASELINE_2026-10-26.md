# Iznera: implementation baseline — 2026-10-26

This is the **pre-implementation baseline**, not a completion report. The active work is tracked in [IMPLEMENTATION_MATRIX.md](IMPLEMENTATION_MATRIX.md). A source file, adapter, environment variable or passing unit test does not establish a working connected product. Later implementation must add dated runtime evidence before changing a requirement to “работает”.

## Scope and evidence

The working repository is `C:/Users/User/projects/TraceLab-web`. Existing uncommitted Astra/public/workspace changes must be preserved. The old `C:/Users/User/projects/TraceLab` and OneDrive project copies are not integration targets. The reference documents below were read, not modified. No private browser records, credentials or environment values were read for this documentation.

Read in full:

| Key | Source | Interpretation |
| --- | --- | --- |
| P | `C:/projects/ernurs projects/TraceLab_Codex_Full_Prompt_2026-10-26.zip`, sole entry `TraceLab_Codex_Complete_Implementation_Prompt_2026-10-26_RU.txt` | Controlling owner request, sections 1–35; extends earlier requirements |
| D00–D09 | Ten files listed below in `C:/Users/User/OneDrive/Документы/unigram/` | Strategy snapshot dated 2026-09-03, not verified current rules or completed research |
| A1 | `C:/projects/ernurs projects/TraceLab_Plan_Compliance_Audit_2026-10-26_RU.txt` | Supplied read-only localhost/browser/code audit; reported observations, not a new run by this document author |
| A2 | `C:/projects/ernurs projects/TraceLab_Awwwards_Full_Audit_Codex_Prompt_RU.md` | Earlier hardening brief and archive findings; old defect assertions require current-code verification |
| R1 | [README](../README.md), [capabilities](../PRODUCT_CAPABILITIES.md) | Older Next application claims dated September; not proof of active static workspace capabilities |
| R2 | [website README](../website/README.md), [PRODUCT](../website/tracelab/PRODUCT.md), [DESIGN](../website/tracelab/DESIGN.md), [VERIFICATION](../website/tracelab/VERIFICATION.md) | Static website scope, older Powder design references and dated checks |
| R3 | [Architecture](ARCHITECTURE.md), [data model](DATA_MODEL.md), [security](SECURITY.md), [free migration](FREE_MODE_MIGRATION.md) | Intended/legacy server structure, with explicitly deferred RLS and unfinished migration |
| R4 | [public material README](../website/tracelab/materials/README.md), public capabilities copy | Duplicated old server claims exposed by the static site |

Directly inspected for this baseline: `website/serve.mjs`, both package manifests, `drizzle/meta/_journal.json`. At that read, static server serves only `website/dist`, accepts GET/HEAD, binds loopback and has no application API; website dev builds then starts it. Root package starts Next and has separate database/test commands. The migration journal ends at 0003; a draft migration file is not evidence of application. Root is changing runtime concurrently: this document intentionally preserves the before-state.

### What each strategy file contributes

| File | Core requirement and consequence |
| --- | --- |
| `00_Master_Strategy.md` | Passive sources + short student why + linked test/decision + policy + season memory. Source immutability, private defaults and student authorship are invariants; an attractive notebook is not the differentiator. Research/retention assumptions remain unproven. |
| `01_Problem_Market_Competition.md` | Observe loss of rationale across tools and cohorts; compare direct competitors, familiar substitutes and professional reference patterns separately. Vendor features do not prove adoption or student ROI. No “first graph” or arbitrary similarity claims. |
| `02_Product_PRD_UX.md` | Private team/season → source Inbox → capture → iteration → test/decision → later retrieval/export. Quantitative and qualitative tests; exact targets; closeout why; offline phone capture; role matrix; user timing targets require measurements. |
| `03_Technical_Architecture_Data.md` | One Postgres evidence core; immutable sources, versioned annotations, typed links, optional AI; RLS plus server authorization, private files, idempotent ingestion/outbox, policy versions and manifests. Do not create another independent evidence database. |
| `04_AI_Compliance_Privacy_Trust.md` | Action-level server policy with dated official sources, fail-safe unknown/stale rules, separate generated/coach/student content, youth privacy and authorized media. Legal review and competition endorsement cannot be manufactured by tests. |
| `05_GTM_Business_Model.md` | Kazakhstan-first pilot, direct observation and coach distribution; no automatic outreach. Original paid organization tiers are superseded by the owner's universally-free requirement, while infrastructure costs/limits remain real. |
| `06_Validation_Metrics_Risks.md` | Interview/paired-measurement protocols, linked decisions, distributed contribution, retrieval and closeout metrics; reject raw counts as productivity. Capture failure, absent retrieval, surveillance drift and policy ambiguity are explicit pivot signals. |
| `07_Build_Roadmap_Backlog.md` | Foundation/tenancy before rich features; GitHub then memory/output; negative DB tests, offline/versioning/security/E2E. Eight public-beta gates need real evidence. Long-term inventory/chat/scouting/CRM/native apps are outside scope. |
| `08_Brand_Naming_Messaging.md` | Engineering memory and student authorship, source-linked motion and honest claims. Owner selected Iznera on 2026-10-28; no trademark/domain clearance is claimed. Latest approved Astra visual direction supersedes earlier style prescriptions. |
| `09_Source_Register.md` | Thirty dated research entries and refresh triggers. Some copied URLs contain line-break/space damage; verify the official destination before policy use. Refresh season rules, competition/vendor facts, naming and legal sources; do not silently carry old limits forward. |

## Before-state: two products, not one verified platform

A1 reports `node website/serve.mjs` on localhost:3000 with all public routes and five `/workspace/?view=` variants: `graph`, `timeline`, `tests`, `history`, `study`. Its graph/timeline/search/JSON/HTML/local editing are real local functionality. Browser storage is scoped by scheme, hostname, port and browser profile; localhost, 127.0.0.1, a new port and GitHub Pages do not share it.

The separate Next tree contains server entities, actions, auth, storage, policy and old integrations. Its existence does not connect the static UI to Postgres. Neither `DATABASE_URL` nor Resend/Supabase configuration alone makes that connection.

| Capability | Baseline | Evidence / remaining proof |
| --- | --- | --- |
| Graph, node movement, links, inspector/list | Working local prototype | A1 observed; keep coordinates, keyboard alternative and semantic relationship status |
| Timeline/replay/record deep link | Partial | A1 search works but query is lost on reload; no full date/subsystem/season/source/author filters or pagination; timezone differs between timeline/inspector |
| Tests and decisions | Partial | Quantitative chart/table and rationale fields exist; empty why is accepted; no full server closeout invariant |
| Local projects/import/export | Working within local limits | A1 JSON/HTML download and native import; not collaboration, server backup or PDF |
| Provenance/version history | Partial and unsafe for new edits | Imported history survives; A1 reproduced destructive body/author replacement and no new annotation version |
| Offline | Missing reliable app shell/media sync | A1 offline reload failed; already-persisted localStorage surviving is not an offline PWA |
| Authentication/shared teams/RLS | Absent in active static UI | Legacy code is partial evidence for reuse; two-user flow and cross-team denial need live DB tests |
| Gallery/model browser upload | Absent in active static UI | Old Next admin-import model viewer does not satisfy browser multi-file library |
| Full locale | Partial | Public RU/EN/KK; workspace remains Russian in A1 |
| Real PDF, policies, provider connections | Not verified in active UI | JSON/HTML is not PDF; old server modules/env names are not live integrations |
| Research/public beta | Unproven | Empty/manual paired-measurement tooling is useful; no supplied real pilot results |

A1 reports **38 website tests passed, zero failed/skipped**, successful route/download checks, no page errors in its sweep, and no page overflow at the checked 320/375 states. It also reports axe `aria-allowed-attr`, mobile `summary-name`, incomplete contrast evaluation and offline failure. These are **supplied audit results**, not rerun in this docs-only work. September Next test/build counts and October 9 presentation checks describe different artifacts; they must not be merged into a current pass count. Physical touch, screen reader, Safari/Firefox, production performance, full security and live provider validation remain unverified.

## Decisions and conflicts

| Earlier instruction / claim | Current resolution | Requirement |
| --- | --- | --- |
| D00/D07 validate before deep build; old PRODUCT says leave server untouched | P explicitly authorizes unified implementation. Still do not declare interviews/retention/gates complete. | TL-01-02, TL-04-01, TL-32-04 |
| D05 paid school tiers, D02 paid admin; legacy billing | All delivered functions free; technical quotas disclosed. Preserve/retire historical billing through a forward migration after restore validation. | TL-31-01, TL-31-02 |
| D00 no full CAD viewer; old browser model upload deferred | Later owner requires separate robot/intake/shooter/assembly/part files and Gallery; implement bounded supported formats, not a PLM/CAD converter claim. | TL-18-03, TL-19-01 |
| Charm light/coral, then Powder docs, then Astra implementation | Latest approved Astra direction preserved; improve readability and accessible states without unsolicited rebranding. | TL-27-01 |
| Root/public material capabilities describe Next | Dated capability statements must distinguish active unified functionality, static demo and legacy modules. | TL-31-03 |
| Previous “no auth” static scope | Superseded by explicit full auth/shared database request; Pages remains a presentation/demo target. | TL-04-02, TL-06-01 |
| Old 15-page/15-MB FTC limits and September policy examples | Historical examples only. Fetch current official season rules, human review, encode version. Unknown/stale risky actions stay blocked/review. | TL-21-02, TL-22-02 |
| Old RLS deferred / application-only allowance | P now explicitly requires Postgres RLS plus application checks and runtime non-bypass role. | TL-08-03 |
| Existing synthetic copy shown as “personal” | Preserve educational origin permanently; personal copy is not real observation. | TL-02-03, TL-05-03 |
| Name conflict warnings vs owner name | Historical naming hold superseded by the owner's Iznera selection on 2026-10-28. Trademark/domain clearance and provider/repository renaming remain separate actions. | TL-32-03 |
| Award ambition | Quality is the target; no guaranteed award or official certification claim. | TL-35-03 |

## Safe migration contract for existing browser data

1. **Inventory without mutation.** Identify the actual origin and profile used by the owner; show local project IDs/names, record/link/study counts and origin flags. Do not enumerate private records into public pages, analytics or screenshots. Never clear localStorage merely to switch backend.
2. **Backup first.** Export every selected project using the existing JSON format, including IDs, relations/statuses, annotation history, node positions, source/author labels, timestamps, measurements/units, study observations and educational origin. Keep the old copy intact. JSON cannot recover media bytes that were never stored; report missing attachments honestly.
3. **Cross-origin transfer is explicit.** Import downloaded JSON when moving from localhost to 127.0.0.1, another port, Pages or device. Do not imply automatic discovery of another origin's browser storage.
4. **Authenticated preview.** After verification/login choose the destination team/season/project. Check membership and permissions server-side. Show supported schema, duplicate IDs, unknown references/types/versions, missing attachments and counts. An imported free-form author label is `originalAuthorLabel`, not proof of the current account identity.
5. **Transactional commit.** Same preview/manifest and team-scoped idempotency key produce the same result. Changed payload with the same key is a conflict. Validate all records/references before writing; preserve source IDs and an explicit mapping. On invalid rows either reject the complete transaction or use an explicitly selected partial workflow with a row report; never quiet partial success.
6. **Version, do not overwrite.** Preserve original source name/body/time and new annotation versions separately. Imported, unverified, student, coach, generated, suggested and educational origins stay distinguishable. Concurrent edits retain both variants and ask for resolution; layout/preferences are not authorship revisions.
7. **Reconcile and prove.** Before/after counts, immutable-source fingerprints, relation endpoint/status mapping and recovered annotation versions must agree. Test repeat commit, bad middle row rollback, wrong-team target, revoked membership, author-label spoofing, synthetic laundering and failed media upload.
8. **Restore drill and handoff.** Restore into an isolated test team/database and verify links/media/manifests, not just file existence. Keep original browser backup until owner verifies the destination. Do not apply migrations or seed existing owner data as part of documentation.

## Gates and external dependencies

| Gate | Evidence needed before enabling/claiming |
| --- | --- |
| G-DB | Clean migration and upgrade on isolated Postgres; least-privilege non-owner NOBYPASSRLS runtime role; two same-team users share data, a third tenant cannot read/write guessed IDs; forced rollback and pool-context tests |
| G-MAIL | Resend account/sender/domain configuration and actual delivery/retry/expiry verification; local preview is explicitly development-only, not “delivered” |
| G-FILES | Private Supabase Storage configuration, scoped retrieval/upload, revocation/TTL, quota and cleanup tests plus combined DB/object restore |
| G-GITHUB | Authorized minimal-scope app installation/repository and signed delivery; fixture tests separate from real-provider success |
| G-POLICY | Current official rules, exact season/version/source/review/staleness and human interpretation; safe unknown defaults; no official endorsement |
| G-ONSHAPE | At least three active pilot teams use/request it; OAuth scopes/state/refresh/revoke and exact revision tests; credentials/real verification separate |
| G-CHAT | Interviews show chat is the stronger capture channel; opt-in bot pairing/identity/whitelist/privacy and real-provider test |
| G-AI | Deterministic retrieval useful and source quality demonstrated; allowed current policy, consent/provider/privacy/quality and grounded-output tests |
| G-COACH | At least two coaches return to process-health views weekly; role/privacy mature, no student ranking or rationale overwrite |
| G-CONTRIBUTION | Students request reuse and mature privacy/authorized evidence export; private by default |
| G-VEX | Real VEX pilot, FTC core retention and reviewed current strict competition policy |
| G-ISEF | Robotics retention/organization model proven plus real pilot and current protected-output/approval review; no pseudo-compliant writer |
| G-LEGAL | Qualified review of youth privacy/consent, school DPA, subprocessors/region, retention/deletion and terms for target jurisdictions |
| G-BRAND | Owner-led naming/domain/trademark review; no unsolicited rebrand/purchase |
| G-BETA | At least three real teams for four weeks; measured median rationale closeout ≤45 seconds; at least two teams retrieve old evidence; no known isolation/destructive-sync defect; export/delete proven; visible fresh/fail-safe policy; privacy/terms/youth review; support and tested incident/rollback plan |

Services may be implemented with safe local adapters and secret-free tests while real credentials are absent. The owner has not authorized provider account creation, paid purchases, DNS changes, deployment, pilot outreach or publication of private data by this prompt. Missing keys do not excuse stopping independent implementation. Do not ask for secret values in chat.

## Evidence update protocol

For each matrix ID attach the actual frontend route/file, server method, schema/migration, test command/result/date and any screenshot or measurement. Label tests fixture/local DB/live provider/manual. Record passed, failed and skipped separately with reasons. Retain this before-state; add dated progress to the matrix instead of rewriting the historical baseline as though the new implementation had always existed.

For the current session the runtime team is implementing in parallel. No new auth, API, database, migration, storage, policy, PDF, i18n or browser result is certified by these two documentation files.

