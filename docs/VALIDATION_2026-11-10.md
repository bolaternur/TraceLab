# Local validation — 10 November 2026

This report covers the changes prepared for the RKNP workflow. It is not a user study, scientific result, cloud acceptance report or claim that every possible interaction is defect-free. Public launch was deferred at the owner's request.

## Changes verified

- A new record and its initially selected relation save in one transaction. Invalid relations roll back the record too.
- Documentation completeness is visible in decisions, tests, iterations and the overview. It checks authored explanations, supporting records, version, conditions, criteria and outcomes. It does not assign scientific validity. Incomplete drafts remain saveable.
- Research summaries pair observations by team, participant, task/pair and attempt. Ambiguous duplicates and invalid/missing values are reported and excluded where appropriate. Per-metric counts and median/IQR are explicit. The supplied CSV template contains headers only.
- Authentication controls are disabled in server HTML until hydration; the fallback form uses POST. Five SSR regression tests cover all auth modes.
- Shared storage supports private Supabase objects without silently falling back to local disk. Deployment preflight, separate migration credentials and opt-in public-page indexing are prepared. No real provider was connected or tested.

## Automated checks

| Check | Result |
| --- | --- |
| Static workspace suite | 198 passed |
| Non-DB Vitest run | 163 passed; 94 DB tests skipped in that run |
| Dedicated isolated PostgreSQL suite | All 94 DB tests passed (15 files) |
| Research summary tests | 14 passed |
| Deployment/preflight tests, final | 15 passed |
| Added auth SSR regression tests | 5 passed |
| Final targeted localization/core tests (subset of static suite) | 17 passed |
| TypeScript | Passed |
| ESLint, final | Passed, zero warnings |
| Next.js production build | Passed |

The DB suite ran on a new dedicated PostgreSQL cluster at loopback port 55432. During those automated tests, the original database configuration and user records were not changed. QA data is deliberately marked artificial and is not included in research results. The subsequent user-approved recovery is described below.

## Browser verification

An isolated Chrome profile and a dedicated QA account/team/project were used:

1. Kazakh signup, local email preview confirmation, sign-in and team creation.
2. Create an explicitly artificial source observation.
3. Create and save an incomplete iteration draft linked to that source.
4. Add a test with conditions, criterion, result and a link to the iteration; completeness updates as fields are filled.
5. Add a closed decision with an authored explanation and the selected test link.
6. Reload; find the explanation in Why/Memory; follow decision to test, iteration and original source. Conditions, criterion and result remain intact.
7. Complete the iteration, reload and verify its status, outcome, next step, linked source/test and two authored revisions.
8. Open all 14 workspace sections and wait for their visible content. No JavaScript page errors or alert errors in this pass. This is navigation coverage, not a claim that calls, integrations and every upload were exhaustively retested.
9. Switch RU/EN/KK; all 14 navigation tabs remain, workspace titles update, automatic relation enums are translated without changing authored labels.
10. In a separate anonymous browser context, verify hydrated sign-in fields are enabled, the form uses POST, and the password visibility toggle works.

The first automated sign-in attempt filled an outgoing document before a full navigation finished. Waiting for the new URL/load fixed the test. Separately, review found and fixed the genuine pre-hydration GET-form risk described above.

## Remaining external acceptance

Before inviting external teams, test actual HTTPS hosting, verified email delivery, cloud file persistence after restart, backup/restore, proxy headers and cross-team isolation on the deployed host. Group voice calls need real devices/network conditions. Local development mail previews are not emails sent to users.

No domain, hosting plan or paid service was purchased. No public deployment, Google indexing request or school submission was performed. The research still needs the student's own protocol, real trials, measurements and written analysis.

Setup reference: [PUBLIC_RELEASE.md](PUBLIC_RELEASE.md).

## User-approved local recovery

The previous local PostgreSQL directory was absent. The owner explicitly chose to reconnect the verified backup dated **1 November 2026**. A separate recovery database was created, all 11 backup manifest counts matched, and the requested project was present. The recovered snapshot has 2 users, 2 teams and 2 projects. All 10 referenced storage objects were present; the full separate storage copy contains 12 files and all copied file hashes match their sources.

The active database, PostgreSQL binaries and separate storage copy now live under the canonical project's ignored `.data` directory, outside OneDrive. The previous environment configuration and original storage are preserved. `.env.local` points at the recovered database; it is ignored by Git. This is the historical November 1 state, not a claim to recover later changes.

`npm run dev` now supports explicitly configured existing Windows PostgreSQL paths: `LOCAL_POSTGRES_BIN`, `LOCAL_POSTGRES_DATA`, `LOCAL_POSTGRES_LOG`, using the local port from `DATABASE_URL`. It never initializes, resets or migrates a database. The original default path on port 5432 remains supported. Syntax, targeted lint and three refusal/remote-host checks passed; the real relocated cluster was started successfully through this launcher.

After reconnection, `/api/health` returned 200, the runtime role was verified non-superuser without createdb/createrole/bypassrls, and the home/sign-in pages loaded without JavaScript errors. The sign-in form is interactive. Existing users' passwords were not reset and their sessions were not impersonated. Mail remains local-only until the separate publication task.
