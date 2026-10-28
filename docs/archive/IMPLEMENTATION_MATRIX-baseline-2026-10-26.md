# TraceLab implementation matrix

Baseline date: **2026-10-26**, before the current unified-app implementation. Scope: all sections 1–35 of the owner's full ZIP prompt. See [baseline and source register](IMPLEMENTATION_BASELINE_2026-10-26.md) for exact source paths, complete ten-document summary, conflicts, migration contract and gates.

This is a requirement registry, **not a declaration of completion**. Each row groups closely related acceptance clauses; every clause in the row must pass before its status becomes “работает”. IDs `TL-SS-NN` are permanent: keep them when splitting, deprecating or attaching implementation evidence. The controlling source for each row is **P §SS**; additional section references appear under the heading. No old brief overrides a later explicit owner requirement.

## Status and evidence rules

Allowed status: **работает**, **частично**, **отсутствует**, **требует внешней настройки**, **требует человеческой проверки**. Here “работает” is explicitly limited to the local audited behavior or completed documentation named in that row; it never implies production readiness. External/human gate status does not imply that implementation is complete.

Evidence profiles include frontend (**F**), backend (**B**), schema (**S**) and tests (**T**). “Absent” means no verified connection in the baseline active UI; a legacy file may exist. For completion replace/extend the profile with exact actual files/routes, migration, command/result/date and test class.

| Profile | F | B | S | T / limitation |
| --- | --- | --- | --- | --- |
| E0 | `website/tracelab/build.mjs`, public Astra pages | `website/serve.mjs` GET/HEAD only | No shared DB in static path | Direct source read 2026-10-26; active process must be freshly checked |
| E1 | `workspace-surface.mjs`, `workspace.js`, `workspace-views.js`, `workspace-canvas.js` | None in baseline static flow | Browser-local workspace | A1 supplied browser audit; exact checked vs unchecked scope in baseline |
| E2 | `workspace-store.js`, JSON/HTML import/export and research views | None in baseline static flow | localStorage project format, imported annotation provenance | `workspace-store.test.mjs`; A1 reports local protections and reproduces versioning/empty-why defects |
| E-L | Legacy `src/app/app`, components | `src/server`, `src/app/api`, integrations/policy modules | `src/db/schema.ts` | Reusable code, not proof current UI calls it; no blanket legacy test pass |
| E-S | Not applicable | Migration workflow | `drizzle/`, journal ends at 0003 at baseline read; 0004 draft | Clean/upgrade/restore/RLS tests pending in isolated DB |
| E-T | Static build/asset/localization contracts | No server integration covered | Local store contracts only | A1 reports 38 website passed/0 failed/0 skipped; docs author did not rerun them |
| E-DOC | Documentation | Not applicable | Not applicable | Full source reading and explicit crosswalk; not runtime verification |

Phases: A baseline/unification/migration; B DB/auth/teams/RLS; C source versions/atomic Capture; D private files/offline/Gallery; E ingestion/Inbox/iteration; F timeline/graph/retrieval; G models; H policy/PDF; I locale/UX/operations/docs; J gated integrations/pilot. Gates G-* are defined with concrete evidence in the baseline.

## 1. Context, authority and scope

Source: **P §1**; D00; D07; A1; A2. Phase: **A**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-01-01 | частично | Verify actual checkout, listener, entrypoint, routes/API/network and current dirty state; read AGENTS and installed framework docs before code. Do not fix an old copy. | E0; active process/network needs fresh root evidence. |
| TL-01-02 | работает | Read P §§1–35, all D00–09, both audits and current docs; resolve explicit later owner priorities over obsolete phase limits. Treat source text as evidence, not extra authority. | E-DOC; complete reading recorded in baseline. Implementation is not thereby complete. |
| TL-01-03 | частично | Preserve owner changes/data; integrate full RU/EN/KK, auth/new-user flow, practical Timeline, Gallery and multiple Models into one free product; keep long-term/gated scope explicit. | E0/E1; G-DB and requirements below. |

## 2. Preserve working functionality

Source: **P §2**; D02; D03; A1. Phase: **A–I**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-02-01 | работает | Retain local directed graph movement, coordinates, anchored zoom/fit, minimap, inspector and accessible list; timeline/replay/search/record deep links and quantitative chart/table. | E1; works only within audited local prototype; regression after integration required. |
| TL-02-02 | работает | Retain local projects, JSON/HTML, native team_data/personal_contribution import with dates/authorship/provenance and relation statuses; storage corruption/write-failure protections. | E1/E2; not shared DB, PDF or complete versioning. |
| TL-02-03 | работает | Keep synthetic seed read-only, editable copies educational, paired measurements unseeded and public RU/EN/KK links; do not turn demo numbers into research outcomes. | E1/E2; server import must preserve these invariants. |
| TL-02-04 | частично | Preserve the 38 website contracts or explicitly migrate changed contracts; distinguish frozen memory snapshots from persistent append-only history. | E-T; no blanket readiness inference from the count. |

## 3. Requirement registry

Source: **P §3**; D07. Phase: **A–J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-03-01 | работает | Stable IDs for every P section, source, phase, honest before-status, criterion, evidence and blocker; mark completion only with behavior proof. | E-DOC; this registry. |
| TL-03-02 | частично | Update F/B/S/T evidence after each implemented slice and list missing/external/human requirements without silently dropping them. | E-DOC; ongoing implementation needs dated progress entries. |

## 4. Unified application

Source: **P §4**; D03; A1. Phase: **A–B**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-04-01 | отсутствует | Public/auth/workspace/API operate under one main localhost app, verified session/membership and shared authoritative records; reuse existing entities rather than a third independent app. | E0/E-L; G-DB; E2E two users and denial. |
| TL-04-02 | частично | Typed API errors/auth/pagination; truthful device/server save states; explicit static demo/offline separation; Pages publishes presentation/demo only. | E0/E1; server persistence and mode contract missing in baseline. |
| TL-04-03 | частично | One documented main dev command plus separate demo/test/migrate/prod commands; direct routes, BASE_PATH, redirect return and back/forward work. | E0/E2; verify actual new entrypoint, not old command by assumption. |

## 5. Local-data migration

Source: **P §5**; D03; D04; A1. Phase: **A–C**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-05-01 | частично | Backup all selected local projects before transition; authenticated preview with names/counts/origin/warnings and explicit destination team; cross-origin transfer via JSON. | E2; G-DB; existing local export is only a starting point. |
| TL-05-02 | отсутствует | Versioned dry-run importer, confirmation, team-scoped idempotency, duplicate/missing/unsupported reconciliation and atomic rollback; unchanged replay safe, changed payload conflicts. | E-L; import integration/fault tests required. |
| TL-05-03 | частично | Preserve dates, types, links/statuses, numbers/units, source IDs, annotation versions, coordinates and manifest; unverified original author labels stay separate from verified importer; synthetic stays synthetic. | E2; server mapping/author spoofing tests missing. |
| TL-05-04 | отсутствует | Report missing file bytes honestly; validate CSV batch IDs/mapping/errors without quiet partial commit; concurrent local/server edits preserve both variants. | E2/E-L; no server conflict/import transaction proof. |
| TL-05-05 | отсутствует | Forward-only schema migrations; clean DB and upgrade plus backup/restore evidence; never reset or seed existing owner data. | E-S; G-DB/G-FILES. |

## 6. Auth and email

Source: **P §6**; D02; D03; D04; A2. Phase: **B**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-06-01 | отсутствует | Minimal signup → verification/resend → login/logout; expiry/used tokens; reset revokes sessions; session list/revoke one/all; verified email change; invite/deep-link continuation; account deletion authorship explanation. | E-L; legacy password session code is not this completed active flow. |
| TL-06-02 | частично | Proper password hash/cost, hashed purpose-bound one-use tokens, secure httpOnly sameSite cookies, rotation, CSRF, safe origins/redirects and reauthentication; production bypass impossible. | E-L; security regression and real DB tests required. |
| TL-06-03 | отсутствует | Rate-limit signup/login/reset/verify/invites; generic responses avoid enumeration; no tokens in URLs/logs/analytics beyond intended one-use links; redact failures. | E-L; attack/rate/expiry tests required. |
| TL-06-04 | отсутствует | RU/EN/KK verification/reset/invite templates; Resend adapter with bounded retries/idempotency/failures; protected local preview only in development; stdout is not delivery. | G-MAIL; provider fixture and actual delivery recorded separately. |
| TL-06-05 | частично | Secret-free env example and precise registration/config/check instructions; use safe local mode without blocking other work; never request/commit real keys or create external accounts without authorization. | E0; G-MAIL/G-FILES; setup guide pending. |

## 7. Onboarding, organizations, teams and seasons

Source: **P §7**; D02; D03. Phase: **B**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-07-01 | отсутствует | Verified account creates a private empty team or accepts invite; minimal name/program/timezone/language, season/project/subsystems; optional organization/team number; progressive back preserves draft. | E-L; no seeded new team; E2E required. |
| TL-07-02 | отсутствует | QR/link invitations have bounded role/expiry/maxUses/revoke/email binding, minimal preview and atomic concurrent consumption; expired/already-used messages and return path work. | E-L; concurrent DB/security tests required. |
| TL-07-03 | отсутствует | Team/project/season switching isolates filters/outbox; active/alumni/removed roles, explicit alumni access, protected last responsible member and no student self-promotion/coach assignment. | E-L; G-DB. |
| TL-07-04 | отсутствует | Season archive/handoff retains authorship and historical policy; exactly one active season where applicable; org membership is not automatic student editing authority. | E-L/E-S; constraint and role tests required. |

## 8. Authorization and RLS

Source: **P §8**; D02 role model; D03 Authorization; D04. Phase: **B–J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-08-01 | отсутствует | Students version own work; leads organize/invite/export within bounds; coach notes separate; org admins manage teams/archives without rewriting student rationale; support access explicit/minimal/audited. | E-L; role/action matrix and negative tests required. |
| TL-08-02 | отсутствует | Every read/write/search/media/export/job validates session, team and referenced ownership; client IDs/roles are untrusted; membership revocation blocks next operation including offline sync. | E-L; exhaustive endpoint and guessed-ID tests required. |
| TL-08-03 | отсутствует | Postgres RLS plus server checks; non-owner NOBYPASSRLS runtime role, transaction-local context reset with pool reuse, separate admin/migration/jobs paths, safely defined membership helper. | E-S; G-DB; direct SQL and two-user/third-tenant tests. |
| TL-08-04 | отсутствует | Role changes transactional with before/after audit, no privilege escalation or deletion/demotion of last lead/admin; coach cannot bypass author controls by organization role. | E-L; concurrent role tests required. |

## 9. Evidence model and versions

Source: **P §9**; D03 Domain model; D04 ownership; A1. Phase: **C**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-09-01 | частично | Use Organization, Team, Membership, Season, Project, Subsystem, SourceConnection/Event, Artifact, Annotation, Iteration, Test, Decision, Relation, PolicyVersion, AIActionLog, Export, AuditEvent and Job; media shares these identities. | E-L/E-S; tables exist in legacy tree, connected paths unverified. |
| TL-09-02 | отсутствует | Source identity/payload/name/body/date/provider ID/hash and occurred/received times immutable; triage separate; artifact hash/MIME/bytes/origin/lifecycle; source deletion state explicit. | E2/E-L; local destructive update defect; DB constraints and tests required. |
| TL-09-03 | отсутствует | Every new annotation edit appends author/origin/sourceMethod/time/supersedes version; recover old content after reload and JSON; conflict edits preserve both branches. | E2; A1 reproduced destructive body/author replacement. |
| TL-09-04 | частично | Imported/source/student/coach/generated/suggestion distinct; relation type/direction/origin/status/invalidation history retained; suggested links need acceptance and CAUSED_BY explicit human claim; hashes are integrity, not legal authorship proof. | E2/E-L; local relation statuses partial, complete domain enforcement missing. |

## 10. Capture

Source: **P §10**; D02 Capture; D03 Offline; A2. Phase: **C–D**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-10-01 | отсутствует | Photo camera/file; Problem/constraint/severity; quantitative/qualitative Test; Decision choice/why/grounds/next; Reflection human learning/failure/next. Current project/season visible, optional context progressive. | E-L; old forms not connected to current UI. |
| TL-10-02 | требует человеческой проверки | Measure photo ≤15s, problem/reflection ≤30s, test/decision ≤45s using real tasks; do not equate automation timing with user performance. | G-BETA; task protocol and consent needed. |
| TL-10-03 | отсутствует | Validate full payload/scope on server; transaction for source/artifact/annotation/test/decision/links/iteration state; staged file finalization/outbox/cleanup; fault injection leaves no partial capture. | E-L; legacy non-atomic path flagged A2; G-DB/G-FILES. |
| TL-10-04 | отсутствует | Team+clientId+payloadHash makes replay idempotent and changed replay conflict; audit/analytics failure cannot create ambiguous duplicate; retain original capture time. | E-L; concurrent/retry/fault tests required. |

## 11. Offline PWA

Source: **P §11**; D02 Offline; D03 Offline; A1. Phase: **D**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-11-01 | отсутствует | Manifest/versioned SW/cache lifecycle lets previously loaded app reload offline; IndexedDB outbox persists blobs and drafts through restart, no base64 localStorage media. | E1; A1 offline reload failed; legacy outbox does not establish current app shell. |
| TL-11-02 | отсутствует | Stable client IDs/original time; pending/syncing/synced/failed/conflict, bounded retry/backoff/cancel and foreground fallback; atomic claims/leases across tabs prevent duplicates. | E-L; offline/restart/multitab tests. |
| TL-11-03 | отсутствует | Sync rechecks current auth/membership and handles expiry/revoke/quota/oversize; stream limit real bytes; no quiet pending deletion; show device vs server truthfully. | E-L; G-DB/G-FILES. |
| TL-11-04 | отсутствует | Private cached data isolated by user/team, explicit logout/shared-device cleanup with unsynced safeguards; no cross-user cached API responses. | E-L; cross-account offline tests. |

## 12. Inbox and human why

Source: **P §12**; D02 Evidence Inbox; D03 provenance. Phase: **E**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-12-01 | отсутствует | Show real provider/actor verification/time/repo/document/thumbnail/link and missing context; classify/link/create iteration/subsystem/archive/ignore/sensitive and batch operations, never delete immutable source on hide. | E-L; source-backed shared Inbox absent. |
| TL-12-02 | требует человеческой проверки | Selected events link within ≤3 taps; time/subsystem grouping explains deterministic suggestions; only human accepts structure, no AI-written rationale. | G-BETA; acceptance usability test plus proposal state tests. |
| TL-12-03 | отсутствует | Short what/why/next preserves existing commit/source text, marks missing explanation, separates coach note and prevents unreviewed content auto-publishing/export. | E-L; author/eligibility tests required. |

## 13. Iterations

Source: **P §13**; D02 Iteration object. Phase: **E**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-13-01 | отсутствует | Versioned iteration includes title/subsystem/problem/change/why/artifacts/tests/outcome/disposition/next/authors; drafts can remain incomplete, exact CAD/commit references retained. | E-L; real connected object required. |
| TL-13-02 | отсутствует | Server close requires human change/why and outcome when test exists; keep/revert/iterate/defer/reject explicit; reopening retains history; evidence gap language avoids student-quality judgments. | E-L; state transition and empty-why regressions. |

## 14. Tests and decisions

Source: **P §14**; D02 Test engine; A1. Phase: **C–E**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-14-01 | частично | Exact subsystem/iteration/CAD/commit/model-version target; question/procedure/conditions/baseline, measured unit/value or qualitative result, trials/successes/criterion/notes/files/date/author and links. | E1/E-L; current chart exists but full domain missing. |
| TL-14-02 | частично | Reject NaN/Infinity, invalid counts/negative attempts, incompatible units/conditions; no invented quantitative values; separate engineering CSV mapping/preview/errors from research CSV. | E2; full server validation/CSV tests required. |
| TL-14-03 | отсутствует | Decision choice/alternatives/student why/supporting tests/disposition/next; explicit draft vs closed; server rejects closing without why; correct directed semantics for test/decision gap queries. | E2/E-L; A1 empty why accepted; negative/direction tests. |

## 15. Timeline

Source: **P §15**; D02 Timeline; A1; A2 Timeline. Phase: **F**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-15-01 | частично | Default newest with order toggle; today/yesterday/date and week/month groups; burst expansion exposes all events; readable short result/decision row with metadata in Details. | E1; audited local vertical timeline is starting point. |
| TL-15-02 | отсутствует | Sticky period/subsystem/season/type plus source/author/context/link filters; URL persists query/order/filter/selection; count/reset; back restores scroll; cursor paging declares completeness. | E1; A1 search reset defect; E2E large-data/back test. |
| TL-15-03 | частично | Real photo→test→decision traversal; add-why/link action; desktop inspector/mobile focus-managed detail; distinguish new-team/filter/disconnected/error/offline pending states. | E1/E-L; real media and server states missing. |
| TL-15-04 | частично | One team/user timezone for feed and inspector; replay pause/keyboard/reduced motion without focus theft; last-subsystem-test→decision usable at 320/375/768/1440 and 200% zoom. | E1; A1 timezone mismatch; manual and E2E required. |

## 16. Graph

Source: **P §16**; D03 Typed relations; A1. Phase: **F**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-16-01 | работает | Preserve local drag coordinates, ports/bounds on resize, zoom/pan/fit/minimap, keyboard link form and list; layout changes do not rewrite engineering evidence. | E1/E2; server layout storage/regression pending. |
| TL-16-02 | частично | Use RESPONDS_TO/IMPLEMENTS/MODIFIES/TESTS/SUPPORTS/CONTRADICTS/SUPERSEDES/DERIVED_FROM/CONTRIBUTED_BY/CAUSED_BY/LEADS_TO/REFERENCES with clear directions/explanations; no orphan/cross-team authoritative link. | E2/E-L; schema/semantic validation needed. |
| TL-16-03 | частично | Suggested/rejected/invalid links never authoritative; bounded graph expansion/filter/counts; mobile readable list/detail and correct pointer cancel/capture; no fabricated causal chain or thousand-node overload. | E1/E2; large-data/touch/role tests missing. |

## 17. Search, memory, failures and handoff

Source: **P §17**; D02 Memory; D07 Phase 5. Phase: **F**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-17-01 | частично | Authorized deterministic title/body/why/tag/metadata search first; subsystem/season/type/author/source filters, paging; why traversal shows actual linked sources and missing rationale honestly. | E1/E-L; local text search is not shared multi-season retrieval. |
| TL-17-02 | отсутствует | Prior-season scope, rejected/reverted/failed results, conditions and next steps; curated handoff with major why/tests/failures/open questions/current state plus source-backed export. | E-L; archive/membership and lineage tests required. |
| TL-17-03 | требует человеческой проверки | Measure new-member answer to documented why in <60s and actual later design use; no inferred rationale or invented retrieval success. | G-BETA; actual paired/longitudinal observations required. |

## 18. Private media and Gallery

Source: **P §18**; D03 storage; D04 privacy; A2 Gallery. Phase: **D**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-18-01 | отсутствует | Private adapter, real browser uploads for supported image/document/bounded video; validate magic/bytes/dimensions/quotas, EXIF/GPS strip/orientation/thumb/hash; local crop/redaction, progress/cancel/retry/camera. | E-L; G-FILES; malicious/file/error tests. |
| TL-18-02 | отсутствует | Staged cleanup; membership proxy/short URL; no new access after revoke and explicit old URL TTL; private cache/bucket, rate/audit/roles, usage and quota errors; no public optimizer leak. | E-L; G-FILES; cross-tenant/expiry/cache tests. |
| TL-18-03 | отсутствует | Gallery uses canonical artifacts/events, grid/list photo/drawing/render/video filters and URL selection/back; caption/alt/original source identity, linked test/decision/model, responsive lazy thumbs. | E-L; no active Gallery baseline. |
| TL-18-04 | отсутствует | Keyboard/touch lightbox prev/next/Escape/focus; multi-select link; archive/delete explains dependencies/retention; honest empty/error/loading states. | E-L; browser/touch/accessibility and lifecycle tests. |

## 19. Models

Source: **P §19**; A2 Models; later owner priority. Phase: **G**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-19-01 | отсутствует | Separate real whole robot/intake/shooter/drivetrain/assembly/part files; category robot/assembly/part distinct from subsystem; metadata/tags/version/author/source/project/season/thumb, search/archive/rename. | E-L; legacy admin-import viewer does not fulfill browser library. |
| TL-19-02 | отсутствует | Upload and version replacement retain old exact test/decision references; authorized delete/archive dependency handling, private thumbnail/quota; never pretend filename is file. | G-FILES; two users and three separate uploads verified. |
| TL-19-03 | частично | Orbit/pan/zoom/reset/fullscreen/wireframe/solid, progress/cancel, lazy Three and resource disposal, WebGL poster fallback and accessible controls. | E-L; viewer exists in legacy tree only; current browser proof required. |
| TL-19-04 | отсутствует | Safe GLB first; bounded glTF package only with controlled resources, no external URI/path traversal; structure/geometry/texture/bytes budgets; optimization lineage; no unsupported STEP/STL/OBJ/exploded-tree/diff claims. | E-L; hostile file/resource budget tests and exact-version regression. |

## 20. Sources and connectors

Source: **P §20**; D03 Integrations; D02 feature gates. Phase: **E–J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-20-01 | отсутствует | GitHub minimal-scope App/justified alternative, installation/repository preview; HMAC/event/schema/body limits; durable idempotent receipt/async queue/retry/replay; completion only after transaction. | E-L; G-GITHUB; duplicate/out-of-order/partial failure tests. |
| TL-20-02 | отсутствует | Preserve commit SHA/repo/branch/actor/occurred+received/exact link, confirmed contributor mapping; metadata only by default; encrypted credentials/rotation/revoke/disconnect, source unavailable state and truthful health. | E-L; G-GITHUB; fixture and real verification separate. |
| TL-20-03 | требует внешней настройки | Onshape gated OAuth/API not scraping; scoped one-use state bound user/team/flow, PKCE where supported, fixed callback origin, refresh/expiry/revoke/failure, exact version/microversion. | G-ONSHAPE; implementation/fixture status must be tracked independently. |
| TL-20-04 | требует внешней настройки | Telegram/Discord only gated requested capture; authenticated pairing/whitelist/consent/identity/media/minimal scope and health; never ingest whole chat by default. | G-CHAT; current provider accounts not verified. |
| TL-20-05 | отсутствует | Connected state only after live provider check; requested credentials/env rows are not connection proof, secrets/PII redacted and wrong-source purge preview available. | E-L; real health/revoke/purge evidence required. |

## 21. Composer and exports

Source: **P §21**; D02 competition UX; D03 exports; D04 integrity. Phase: **H**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-21-01 | частично | Keep full JSON/HTML and add composer selecting eligible exact-version sources, human caption/why/media, missing warnings, current profile/version and preview. | E1/E-L; no active composer baseline. |
| TL-21-02 | отсутствует | Generate real A4/Letter PDF with readable fonts/images/pagination and active-policy page/byte/PII/content preflight; important evidence self-contained, no hidden first-500 truncation. | E-L; actual PDF parsing/render/size tests; G-POLICY. |
| TL-21-03 | отсутствует | Immutable versioned exports with exact IDs/versions/origins/generated references/policy/time/creator/hash; re-export creates new output; authorized download/jobs progress/retry/cancel/stale recovery. | E-L; DB/job/authorization tests. |
| TL-21-04 | частично | Authorized contribution/team/handoff/backup scope; ZIP/JSON/media/manifest restore, no missing bytes fabricated; browser print alone not a verified PDF pipeline. | E2/E-L; G-FILES and isolated restoration. |

## 22. Policy engine

Source: **P §22**; D03 Policy; D04 lifecycle; D09. Phase: **H**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-22-01 | частично | Immutable CompetitionProfile/PolicyVersion/action registry; evaluator ALLOW/ALLOW_WITH_DISCLOSURE/BLOCK/REQUIRE_REVIEW; visible source/review/effective/staleness/changelog and pinned historical versions. | E-L; legacy policy skeleton not active workspace proof. |
| TL-22-02 | требует человеческой проверки | Review latest official season texts/URLs and encode exact scope; unknown/stale/ambiguous blocks risky operations while original capture/read remains usable; old FTC limits not assumed. | G-POLICY; September source snapshot is not current approval. |
| TL-22-03 | отсутствует | Server gates rewrite, summary/export, organize, grammar, transcribe, translate student content, generate code, suggest relation and export; UI explains result; every version/action/role has regression coverage. | E-L; direct API bypass tests and policy audit required. |

## 23. AI boundaries

Source: **P §23**; D03 AI; D04 answer contract. Phase: **J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-23-01 | частично | Core works without LLM; gated only with demand/source quality/current policy; outputs separate from originals with provider/model/version/input refs/decision/hash/disposition. | E-L; no active LLM is not itself a defect; G-AI. |
| TL-23-02 | отсутствует | Every factual memory assertion authorized and cited; distinguish student statement/inference/not documented; export rechecks policy; retrieval untrusted, prevent prompt injection/cross-tenant leakage with limits/timeouts/disable. | G-AI; adversarial grounded-output tests required before enablement. |
| TL-23-03 | частично | Fake provider only tests; UI locale never rewrites student source; content translation explicit consent/version/origin and policy. | E1/E-L; runtime guard/localization evidence required. |

## 24. Coach, organization and contribution

Source: **P §24**; D02 gates/roles; D04 privacy; D07 Phase 6. Phase: **J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-24-01 | требует человеческой проверки | Coach gaps/stale tests/source/policy health and separate notes only after demand; no XP, raw-commit leaderboard or student rationale rewrite. | G-COACH; role and authorship proof also needed. |
| TL-24-02 | частично | Org teams/roles/archives/transfers/handoff/retention/export/delete/audit/quotas/connections on shared core; not a substitute for working student workflow. | E-L; organization path not integrated. |
| TL-24-03 | требует человеческой проверки | Private source-backed personal contribution and authorized self-export only with student demand/privacy maturity, no public minors or score. | G-CONTRIBUTION; implementation status not implied by gate. |

## 25. Settings, notifications and feedback

Source: **P §25**; D02 roles; D04 privacy; A2 community. Phase: **I**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-25-01 | отсутствует | Persist profile/locale/timezone/security/sessions/email/password/preferences/team roles/connections/export/delete/usage and supported theme; read/write behavior, not dead controls. | E-L; end-to-end persistence required. |
| TL-25-02 | отсутствует | Notifications have read state, origin, safe invitation/export/source/offline/policy deep links, dedup/retry/mute/digest and minimal PII; preferences affect delivery. | E-L; worker/email tests required. |
| TL-25-03 | частично | Feedback private with explicit versioned publication consent, visibility/delete; no fake testimonials; heatmap is not effort/quality; research secondary. | E1/E-L; consent/lifecycle verification needed. |

## 26. RU / EN / KK

Source: **P §26**; D02 UX; D05 regional strategy; A2 i18n. Phase: **I**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-26-01 | частично | Typed semantic dictionaries across public/auth/onboarding/workspace/forms/errors/loading/dialogs/toasts/inspectors/help/settings/emails/export labels/metadata/aria/title/alt; no English-phrase lookup as core method. | E1/E-L; public translated, active workspace ru in A1. |
| TL-26-02 | отсутствует | CI missing keys/literals/plurals; locale-aware numbers/units/dates/timezone/html lang; guest cookie and profile persistence without draft/query/selection/scroll loss; retain authored source language. | E-L; EN signup→team→upload→timeline→export, then RU/KK E2E. |
| TL-26-03 | требует человеческой проверки | Kazakh ӘҒҚҢӨҰҮҺІ fonts and long RU/KK layouts verified; native review of meaning, errors and emails; no unmeasured full-localization claim. | G-LEGAL not required for translation itself; native reviewer and visual QA pending. |

## 27. Design and navigation

Source: **P §27**; A2 design; D08; latest Astra approval. Phase: **I**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-27-01 | частично | Keep approved Astra identity; readable body 14–16/secondary ≥12, source IDs in Details, restrained cards/labels/dots/glow and consistent typography/spacing/icons/tokens/states. | E1; A1 small labels/touch targets remain. |
| TL-27-02 | частично | 44px targets, keyboard/focus/touch, 200% zoom/contrast/reduced motion; motion explains lineage, no scroll hijack; real engineering media and measured charts only. | E1; full manual/axe/production motion performance proof missing. |
| TL-27-03 | отсутствует | Free team creation CTA goes to real registration; demo/sign-in distinct; stable loading, autofill/show password/inline errors/verification/privacy and no urgency/trial/tier selection. | E1/E-L; auth integration missing. |
| TL-27-04 | частично | Group Today/Capture/Inbox/Timeline/Iterations/Tests/Decisions/Gallery/Models/Explore/Portfolio/Team, role-gated coach/org; research/feedback secondary; dev-only real component states, no empty tabs. | E1/E-L; navigation follows real delivered features. |

## 28. Specific regressions

Source: **P §28**; A1 defect list. Phase: **A–I**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-28-01 | отсутствует | Restrict aria-selected updates to actual tabs, not .ws-shell; mobile project summary retains accessible name with visual span hidden. | E1; A1 axe aria-allowed-attr/summary-name failures; rerun required. |
| TL-28-02 | отсутствует | Persist timeline search in URL/reload and use consistent timezone; repair small labels/34px controls and stale public materials without removing truthful limitations. | E1/E-DOC; A1 reproductions; browser regression pending. |
| TL-28-03 | частично | Preserve record deep links, graph list, test table and back behavior after fixes; verify in browser rather than trusting selectors/source only. | E1; post-change E2E required. |

## 29. Privacy, security and deletion

Source: **P §29**; D04 youth privacy; A2 P0. Phase: **B–J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-29-01 | частично | Private team/files by default; minimal profile/analytics/export names; explicit publication/photo/external-AI consent; honest subprocessor/region/backup/retention terms. | E-L; active static has no shared tenancy. |
| TL-29-02 | отсутствует | Authorized personal/team export/delete, reauth/destructive confirmation/audit/cleanup; account removal avoids destroying others' evidence; retention/anonymization reconciles provenance and PII; source-purge preview and backup eventual deletion explained. | E-L; restore/deletion tests and G-LEGAL. |
| TL-29-03 | частично | Redact logs/errors/screenshots; defend upload/import/export against XSS/traversal/prototype pollution/archive bombs/resource exhaustion; headers/CSP/private cache compatible without global weakening for viewer. | E-L/E2; adversarial tests and CI required. |
| TL-29-04 | отсутствует | Dependency/secret/license scanning and endpoint rate limiting in CI/production; precise counsel packet for school/child privacy instead of certification badges. | E-L; G-LEGAL; security evidence pending. |

## 30. Quotas, jobs, reliability

Source: **P §30**; D03 jobs/observability; A2. Phase: **B–I**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-30-01 | отсутствует | Server storage/user/team/upload limits, documented actual values and completeness pagination; old 3 teams/50 members/2GiB are targets, not proven guarantees or paid tiers. | E-L/E2; owner/technical limit decision plus concurrency tests. |
| TL-30-02 | частично | Durable idempotent jobs, lease/heartbeat/stale recovery/retry budget/failed-dead-letter state; transactional outbox aligns DB, file, email and webhooks. | E-L; actual worker crash/restore tests missing. |
| TL-30-03 | частично | Liveness separate readiness DB/migrations/private storage/worker freshness; structured redacted request logs/error monitoring; no full student text in analytics. | E-L; health DB-only baseline; provider check pending. |
| TL-30-04 | отсутствует | Instrument capture created/synced, source ingested, Inbox linked, iteration closed, decision/test link, old evidence opened, export and policy blocked; no rankings. | E-L; event schema/no-PII tests. |
| TL-30-05 | отсутствует | Combined DB/object backup restored isolated; RPO/RTO targets separate from measured drill; local/staging/prod separation and secret-free unit CI. | G-DB/G-FILES; restore timing evidence required. |

## 31. Free product and honest claims

Source: **P §31**; P later owner decision; D05 superseded. Phase: **A–I**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-31-01 | частично | All implemented Models/Gallery/export/coach/org features free; no paid tiers/trial/checkout/feature paygates; disclose technical quotas, distinguish readiness/policy gates. | E1/E-L; old billing branches still require reconciliation. |
| TL-31-02 | отсутствует | Audit actual billing dependencies; archive legacy data with new migration and restore proof before removing active entitlement/pricing/subscription paths; preserve old migrations/team history. | E-S; draft 0004 is not registered/applied; G-DB. |
| TL-31-03 | отсутствует | Date and reconcile README, capabilities, public project-overview/capabilities, FAQ/privacy/UI promises and launch links to actual running product; preserve honest warnings until behavior exists. | E-DOC; A1 stale public claims; separate baseline is not their correction. |

## 32. Pilot, competition research and brand

Source: **P §32**; D00–D09; D07 beta gate. Phase: **J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-32-01 | частично | Prepare 20-team/coach interview tracker, 10 artifact-walkthrough templates, consent/privacy and 3–5-team pilot/onboarding; paired task/condition/code/dates/order/units/errors protocol and anonymized raw export/reproducible summary. | E2; measurement tool exists but broader packet/real results absent. |
| TL-32-02 | требует человеческой проверки | Real four-week repeated use, linked decisions/retrieval/closeout/distributed contributors/retention; demo separated; no invented interview/traction/testimonial/ROI and no unsolicited outreach. | G-BETA; researcher/owner executes real observations. |
| TL-32-03 | требует человеческой проверки | Dated primary-source competitor/substitute/pattern matrix, truthful passive-source/human-why/trace/memory claims; naming/domain/trademark checklist, no autonomous rename/purchase. | G-BRAND; fresh research required before current marketing claims. |
| TL-32-04 | требует человеческой проверки | All eight D07 public-beta gates verified independently: ≥3 teams ×4 weeks, median closeout ≤45s, ≥2 teams old retrieval, no known isolation/destructive sync, export/delete, fresh/fail-safe policy, privacy/terms/youth review, support+incident rollback. | G-BETA; none inferred from unit counts or a demo. |
| TL-32-05 | требует человеческой проверки | Onshape/chat/AI/coach/contribution/VEX/ISEF readiness separate from implementation; protect demand/current-rule gates; exclude LMS/inventory/scouting/CRM/budget/chat/native apps expansion. | G-ONSHAPE/G-CHAT/G-AI/G-COACH/G-CONTRIBUTION/G-VEX/G-ISEF. |

## 33. Verification

Source: **P §33**; D07 testing; A2 final gate. Phase: **A–J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-33-01 | частично | Run correct active-project baseline then lint/typecheck/unit/integration/i18n/build/browser E2E; retain website contracts; report pass/fail/skip by class, never disable DB/failing suites for green summary. | E-T; current session results pending. |
| TL-33-02 | отсутствует | AUTH scenarios 1–5: signup/verify/team persistence; same-team invite sharing; guessed-ID foreign denial; role/last-lead/coach protection; logout/revoke/reset/expired/used token denial. | G-DB; real isolated DB and browser proof. |
| TL-33-03 | отсутствует | DATA scenarios 6–12: preview migration/history; synthetic lineage; offline photo/problem/test reload; idempotent timestamp; revoked sync; concurrent versions; DB/storage fault rollback. | G-DB/G-FILES; injection/restart proof. |
| TL-33-04 | отсутствует | CORE scenarios 13–20: signed repeated GitHub; Inbox→iteration→test→decision; closeout why; immutable source edit; photo/thumb/Gallery links; three models; exact older version; foreign/invalid/expired media denial. | G-GITHUB/G-FILES; fixtures vs live provider clearly separated. |
| TL-33-05 | отсутствует | OUTPUT scenarios 21–24: real PDF pages/bytes/media/PII/manifest; unknown/stale policy/direct API denial; versioned re-export; clean restore and correct account/team deletion. | G-POLICY/G-DB/G-FILES. |
| TL-33-06 | отсутствует | UI scenarios 25–30: full RU/EN/KK; URL/pagination/back/scroll; keyboard/focus/200%/reduced; 320/375/768/1024/1440 no overlap; axe named regressions+manual contrast; target browser and physical touch separately. | E1; prior limited checks not full acceptance. |
| TL-33-07 | отсутствует | Production-profile measured CLS<0.1/LCP≤2.5s/INP≤200ms and route bundles; lazy graph/Three; WCAG auto+manual (not certification), security/license/secret scans; disclose environment limits. | E1; no current production/mobile measurements. |

## 34. Implementation sequence

Source: **P §34**; D07; P §34. Phase: **A–J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-34-01 | частично | A entrypoint/baseline/migration → B DB/auth/team/RLS (two-user/third-denial first) → C immutable/versioned atomic Capture → D private files/PWA/Gallery → E GitHub/Inbox/core flow. | E-DOC/E-L; execute vertical slices, not only planning. |
| TL-34-02 | отсутствует | F Timeline/Graph/retrieval → G Models → H policy/PDF → I locales/UX/settings/notifs/accessibility/performance/docs → J gated features/pilot; dependency-driven reordering allowed but no silent skipped phase. | E-L; proof required per row. |
| TL-34-03 | частично | Continue independent work through real blockers; separate session stop from product completion; new UI labels/endpoints alone do not satisfy full behaviors. | E-DOC; ongoing evidence ledger below. |

## 35. User handoff

Source: **P §35**; D02; P §35. Phase: **I–J**.

| Stable ID | Baseline status | Requirement and acceptance criterion | Baseline evidence / blocker |
| --- | --- | --- | --- |
| TL-35-01 | отсутствует | RU/EN/KK guides for every actual tab: purpose/role/first step/data/example/change/preservation/links/empty/error/offline/privacy/competition; contextual help concise. | E-DOC; guides not yet verified. |
| TL-35-02 | отсутствует | Three truthful walkthroughs: new member signup→team→photo→test→decision→history; coach/lead invite→gap→sources→handoff; portfolio evidence→policy→preview→PDF/backup. | E-L; no walkthrough may skip unimplemented steps silently. |
| TL-35-03 | частично | Final report exact path/entrypoint/commands/URL, matrix evidence, migration/restore, bugs/tests/screenshots, actual test/i18n/a11y/perf, service/env names/setup, blockers/gates/discrepancies and plain-language value; no guaranteed award or hidden backend absence. | E-DOC; final runtime report pending. |

## Dated implementation evidence (append, do not erase baseline)

No runtime completion has been certified by this documentation task. The implementation owner should append rows as slices are tested:

| Date / revision | Requirement IDs | Actual frontend / backend / schema files | Verification command / environment / result | Remaining limits |
| --- | --- | --- | --- | --- |
| 2026-10-26, documentation baseline | TL-01-02, TL-03-01 | This matrix and baseline | Read P in full, D00–D09, A1/A2 and named repository docs/source; 35 sections represented | Does not certify runtime, fresh policy review, providers or pilot |

Before final handoff reconcile every affected row; retain explicit blocked/missing/human status for everything not demonstrated. Never replace G-BETA with a percentage of screens or tests.

