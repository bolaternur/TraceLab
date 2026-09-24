# TraceLab — RKNP Daryn competition upgrade

Date: 2026-09-06

This checkpoint keeps TraceLab's existing evidence/provenance architecture and focuses on competition readiness, scientific defensibility, runtime safety and a memorable judge demo.

## Product / frontend

- Unified competition-facing product identity as **TraceLab** across package metadata, public UI and policy copy.
- Added **Trace Replay** to the real Engineering Timeline. Replay advances through the authoritative displayed evidence entries; it is not a fake animation layer.
- Added public **`/showcase`** with a trilingual 60-second evidence replay for judges. Demo numbers are explicitly labeled as demo data and are checked against the seeded engineering example.
- Added public **`/research`** explaining the research question, hypothesis, experimental design, outcomes and integrity rules in EN/RU/KK.
- Added authenticated **`/app/research`** showing real process-health evidence from the active team without presenting those signals as causal pilot results.
- Public landing trace now uses one internally consistent seed-backed story: Onshape rev 23, 32→36 mm roller spacing, identical 20-trial tests, 11/20→17/20, then the linked decision.

## Backend / trust hardening

- Fixed a cross-tenant idempotency flaw: offline `clientId` uniqueness is now scoped to **`teamId + clientId`** instead of globally.
- Added migration `drizzle/0001_team_scoped_capture_idempotency.sql` and a tenancy regression test.
- Bounded offline sync into client-side batches (8 items / ~8 MiB target) with a 10 MiB server request cap, so a workshop reconnect cannot send an unbounded photo queue in one request.
- Production session/team/OAuth cookies now use secure-cookie behavior unless the explicit development escape hatch is exactly `true`.
- Connector secret encryption now fails closed in production when `SECRETS_ENCRYPTION_KEY` is missing or too short.
- Added CSP and common security headers; removed the framework disclosure header.

## RKNP research toolkit

Added `docs/rknp/`:

- `RKNP_RESEARCH_PROTOCOL.md` — research question, hypotheses, matched comparison design, metrics and integrity rules.
- `RKNP_JUDGE_DEMO.md` — concise defense sequence built around Problem → Capture → Replay → Why? → Research proof → Trust.
- `RKNP_READINESS_CHECKLIST.md` — scientific/product/demo readiness gates and Daryn evaluation alignment.
- `pilot_measurements_template.csv` — raw measurement template for real pilot observations.

Added `npm run research:summary -- <input.csv> <output.md>`. It calculates descriptive medians, matched-pair time deltas and binary rates from real pilot measurements. It intentionally does not manufacture significance or causal claims.

## Verification performed in this artifact environment

`npm run frontend:verify` is green on this checkpoint:

- Frontend contracts: **85/85 PASS**
- Pure/model tests: **36/36 PASS**
- Static accessibility/motion/design audit: **PASS across 149 source files**
- TypeScript/TSX syntax-transpile: **160 files, 0 syntax errors**

## Verification still required on a machine with npm registry access

This environment could not complete dependency installation, so do not call this build framework/production verified yet. Run locally:

```bash
npm install
npm run db:migrate
npm run frontend:verify
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

Keep the generated `package-lock.json` after a successful install so the competition build is reproducible.

## Competition integrity

- Seed/showcase numbers are **demo data**, not pilot results.
- Do not claim performance improvements until the raw pilot CSV contains real observations.
- Do not claim official VEX/FIRST/Daryn compliance or certification without authorization.
- TraceLab remains the competition-facing project name; commercial trademark/domain clearance is still required before launch.
