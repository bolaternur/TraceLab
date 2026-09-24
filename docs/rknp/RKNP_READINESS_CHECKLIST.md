# TraceLab — RKNP readiness checklist

## Scientific
- [ ] Research question is stated in one sentence.
- [ ] H0/H1 are explicit.
- [ ] Baseline and TraceLab conditions are comparable.
- [ ] Pilot data is real, anonymized, and reproducible.
- [ ] Results include negative/null findings and limitations.
- [ ] No causal claim is made from process-health metrics alone.

## Product
- [ ] `npm run frontend:verify` passes.
- [ ] `npm run typecheck` passes on a machine with installed dependencies.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes with a seeded PostgreSQL test database.
- [ ] `npm run build` passes.
- [ ] `/showcase`, `/research`, `/app`, `/app/timeline`, `/app/graph`, `/app/research` are browser-QA checked.
- [ ] Offline capture → reconnect → sync is demonstrated.
- [ ] Tenant-isolation tests pass after migration `0001_team_scoped_capture_idempotency.sql`.

## Demo
- [ ] One real engineering decision has source + rationale + test + decision links.
- [ ] Trace Replay is rehearsed and fits inside 40 seconds.
- [ ] Why? returns a clear evidence-backed answer.
- [ ] A failure from an earlier iteration/season can be retrieved.
- [ ] A backup demo dataset is available if live integrations fail.

## Presentation
- [ ] Problem shown before features.
- [ ] Novelty claim is narrow and defensible.
- [ ] No claim of official VEX/FIRST/ISEF certification.
- [ ] No fabricated market or experiment numbers.
- [ ] Screenshots/video backup available offline.

## Alignment to Daryn scientific review

Use the project evidence to answer the review criteria directly:

- **Relevance:** show the observed loss of engineering rationale across GitHub/CAD/photos/tests and pilot interview evidence.
- **Novelty:** defend the combined student-owned provenance + short human rationale + typed test/decision links + competition-policy controls; do not claim that knowledge graphs themselves are new.
- **Research method:** pre-register the matched baseline vs TraceLab tasks, preserve raw measurements and explain limitations.
- **Scientific and applied significance:** report retrieval time, supporting-evidence time, documentation time and evidence-link rate from real pilots.
- **Results vs objectives:** every conclusion must map back to a predeclared outcome; demo/seed numbers are never pilot results.
- **Presentation:** use the 60-second Showcase, then move immediately to the real research protocol and evidence.

Generate a descriptive report from collected measurements with:

```bash
npm run research:summary -- path/to/real_pilot.csv docs/rknp/PILOT_RESULTS.generated.md
```

The script reports medians, matched-pair time deltas and binary rates. It intentionally does not manufacture p-values or causal claims.
