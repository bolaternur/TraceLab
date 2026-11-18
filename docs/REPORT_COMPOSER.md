# Report composer and competition gate

The workspace report dialog uses the existing authenticated report service and export jobs. It does not create a second store or activate a competition policy. Source records, annotations and files remain unchanged.

## User flow

Choose purpose, format and scope. Personal scope includes only permitted records authored by the current account; handoff remains an explicitly selected project snapshot. Choose evidence, move records up or down and optionally create contiguous sections by record type. The contents preview shows author text excerpts and attachment treatment. JPEG/PNG files within the image budget are candidates for embedding, subject to storage/hash/aggregate checks during generation. GLB, WebP and other attachments are explicitly references only in this pipeline.

Review warnings and sharing permission. Generation captures an immutable snapshot with ordered records, sections, source/annotation hashes, policy and authorship. A project edit after the initial preview rejects generation with `report_preview_changed`; reopen and review the current evidence. Retrying a previously failed job retains its already captured snapshot.

After generation the dialog shows actual byte size and actual PDF page count, a protected PDF inspection link, the download and a separate provenance-manifest download. It does not claim that the contents preview is a measured PDF layout. Closing the dialog does not cancel a running report; explicit cancellation remains available in saved reports.

## Competition output

Competition output requires PDF. HTML/JSON engineering reports have no measured pagination and cannot be relabelled as competition submissions. The PDF has one identification cover, followed by content. Font sizes in the competition renderer are at least 10 pt. The technical provenance appendix and embedded JSON attachment are omitted from the competition PDF; the complete manifest remains in the export snapshot and can be downloaded separately with the same membership checks.

The server checks actual total pages and content pages independently, actual file bytes with an exclusive maximum, missing/nonembedded evidence, missing rationale/links and any reviewed content-date window. The cover requires an explicit team number for FTC. These technical checks do not certify eligibility, event instructions, name minimization, permission to share or award readiness.

## Registering a policy safely

Only an authorized administrator may register a new reviewed version through the existing policy workflow. The report dialog shows policy program, season, version, review/effective dates, source links, budgets and the reason for blocking. It cannot approve a policy.

Existing checks remain: active status; exact program and season; reviewer; review date within 30 days; effective date; expiry; HTTPS source URLs; permitted export action; finite positive page/file limits. FTC also needs explicit reviewed values for `coverPages: 1`, `maxContentPages`, `maxPages` equal to cover plus content, `fileUnit: "MB"`, `fileLimitExclusive: true`, and `contentNotBefore` as a UTC midnight ISO timestamp. These fields must come from the reviewed season/event rules rather than defaults copied from a prior season. A team number belongs to the individual report input, not to a shared policy.

On **1 November 2026**, the official FTC manual URL returned **2026–2027 TU06**. A201 specifies an identification cover, up to 15 content pages, A4/Letter and a digital submission smaller than 15 MB; it also limits the covered activity period and discusses readability, privacy and AI credit. This observation is documentation of a source check, **not activation or human approval of a production policy**. Review the manual and event-specific instructions again before registering or using a version.

Official source: [FTC Competition Manual](https://ftc-resources.firstinspires.org/file/ftc/game/manual), A201–A202, pp. 48–49. No private team or policy was changed during implementation.

## Remaining limits

This is a deterministic evidence composer, not a free-position page designer. Sections currently follow record types in the chosen order. Missing/unsupported media blocks competition export; no silent placeholder is presented as embedded evidence. Current season policy selection and administrative review are external to this dialog. Production policy registration, email delivery, storage persistence/backups and real event submission require their own verification. Do not remove the gate to make the button look enabled.

## Verification and repeatable local tests

The report change passed 10 renderer/model unit tests, 4 static sequencing/localization tests and 6 PostgreSQL report fixtures on a newly created empty database, `iznera_test_report_1793479576220_82633d38`, retained for inspection. Its migrations and fixtures did not target an existing development/team database. The fixtures cover exact order/sections, immutable output and hashes, retry snapshots, stale preview rejection, role/tenant access and revocation. These results do not prove external delivery, production storage or real event submission.

Use `node scripts/test-report-isolated.mjs` for the report subset, or `node scripts/test-isolated-db.mjs` for all self-contained database fixture suites. Both now use the same guarded runner: it accepts plain loopback PostgreSQL connections only, creates a new `tracelab_unified_test_<timestamp>_<random>` database, applies migrations there and retains it. It rejects production mode, remote/parameter-overridden connections, missing results and unexpected skipped tests. The full runner explicitly excludes `tests/tenancy.db.test.ts`, a legacy test requiring the old seeded demo; current workspace/team/media/report fixtures exercise real RLS without that seed. An operator needs local `CREATEDB` permission; absence of that permission leaves the tests unrun rather than reusing a team database.

Season rollover integration reads the reserved `izneraPolicyAnchor` from the selected season. A valid old-season anchor loads exactly its recorded version/profile; an explicit null or malformed anchor fails closed. A new unreviewed season therefore cannot inherit a later team policy silently. Unanchored legacy seasons retain their previous behavior until the controlled handoff workflow pins them.
