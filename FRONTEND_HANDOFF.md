# TraceLab Living Evidence Lab — Frontend Handoff

**Date:** 2026-09-04  
**Workspace:** `tracelab_frontend_build`  
**Design direction:** Living Evidence Lab  
**Status:** frontend refactor implemented and dependency-free verification is green; full framework verification remains blocked by npm registry connectivity in this environment.

## What this build changes

The frontend has been moved away from a generic notebook/dashboard mental model and toward the product thesis: **work → why → evidence → test → decision → next iteration**.

### Core surfaces

- **App shell:** evidence-led navigation, responsive mobile navigation, name-independent Trace Mark, keyboard command palette (`Ctrl/⌘ K`).
- **Today:** missing human context is the primary queue; no vanity KPI hero.
- **Capture:** workshop/mobile-first launcher with the existing local-first IndexedDB outbox preserved.
- **30-second Why:** dedicated source-context flow; known source facts are shown and only the student rationale is requested.
- **Evidence Inbox:** direct `Add the why` path into the focused context flow.
- **Engineering Timeline:** engineering meaning and causality are emphasized over raw activity.
- **Evidence Trace:** bounded power view (30 visible nodes by default), focused relations, timeline escape hatch.
- **Memory:** evidence-first retrieval rather than a giant AI-chat identity.
- **Tests:** result → linked decision is visible at a glance.
- **Decision detail:** student-authored rationale, supporting evidence, source history, relation linking.
- **Competition Mode:** active policy pack, explicit restrictions, fail-closed trust language.
- **Outputs:** output selector + trust validation + preview instead of an export utility dump.
- **Coach:** process-health interventions, explicitly not a student ranking.
- **Cross-season handoff:** “Start here next season” framing with failures, unresolved questions and decision links.
- **Onboarding:** progressive four-step flow — Project → Competition → Workshop defaults → Trust — while preserving the existing `createTeam` server contract.
- **Organization:** continuity-first team archive, access, retention and audit instead of a generic metric dashboard.
- **Public landing/auth/offline/docs:** aligned with the same evidence vocabulary and TraceLab identity; old `Quick Capture`, `Time Machine`, `grid-paper` and generic KPI language removed.

## Backend/domain invariants intentionally preserved

This work does **not** replace the product's existing domain and trust architecture. It preserves:

- server-side team authorization and tenant boundaries;
- append-only/source provenance semantics;
- versioned student annotations;
- competition policy evaluation;
- existing create-team/team-season-project flow;
- offline capture outbox and later sync;
- existing capture/server actions and evidence queries;
- original media/source lineage behavior.

No new runtime UI dependency was added. The uploaded Material 3, shadcn/Base UI, ReUI, Kibo and design-engineering resources were used as design/interaction references; this pass does not vendor large third-party component code into the product.

## Verification embedded in the project

Run:

```bash
npm run frontend:verify
```

That command executes:

1. `frontend:contract` — dependency-free Node contract tests for the frontend product rules;
2. `frontend:audit` — static accessibility/motion/interaction checks;
3. `frontend:syntax` — TypeScript/TSX transpile syntax check.

### Fresh result in the build environment

```text
Frontend contract tests: 33 passed, 0 failed
Frontend static audit: passed across 94 source files
TypeScript transpile/syntax: 99 TS/TSX files, 0 syntax errors
```

## Full framework verification still required

The source ZIP did not contain `node_modules` or a lockfile. The current container cannot resolve `registry.npmjs.org` (`EAI_AGAIN`), so it cannot install the declared Next/React/Drizzle/TypeScript dependencies.

On a machine with npm network access, run **in this order**:

```bash
npm install
npm run frontend:verify
npm run typecheck
npm run lint
npm test
npm run build
```

If `npm install` creates `package-lock.json`, keep and commit it so future builds are reproducible.

Do not call the refactor production-verified until all five framework-level commands after install are green. If a framework check finds an issue, fix that issue without weakening the frontend contract tests.

## Key new files

- `src/components/tracelab/brand-mark.tsx`
- `src/components/tracelab/command-palette.tsx`
- `src/components/tracelab/capture-type-card.tsx`
- `src/components/tracelab/evidence-row.tsx`
- `src/components/tracelab/missing-context-card.tsx`
- `src/components/tracelab/process-health-card.tsx`
- `src/components/tracelab/process-strip.tsx`
- `src/components/tracelab/sync-status.tsx`
- `src/components/tracelab/timeline-event.tsx`
- `src/components/tracelab/timeline-group.tsx`
- `src/components/tracelab/trace-icon.tsx`
- `src/app/app/context/[id]/page.tsx`
- `src/app/app/decisions/[id]/page.tsx`
- `tests/frontend-contract.node.test.ts`
- `scripts/frontend-static-audit.mjs`
- `scripts/frontend-syntax-check.cjs`
- `public/evidence/demo-robot.jpg`

## Existing files intentionally modified

- `package.json`
- `src/app/app/capture/capture-sheet.tsx`
- `src/app/app/capture/page.tsx`
- `src/app/app/coach/page.tsx`
- `src/app/app/competition/page.tsx`
- `src/app/app/decisions/page.tsx`
- `src/app/app/exports/page.tsx`
- `src/app/app/graph/graph-view.tsx`
- `src/app/app/graph/page.tsx`
- `src/app/app/handoff/page.tsx`
- `src/app/app/inbox/page.tsx`
- `src/app/app/layout.tsx`
- `src/app/app/memory/ask-form.tsx`
- `src/app/app/memory/page.tsx`
- `src/app/app/page.tsx`
- `src/app/app/tests/[id]/page.tsx`
- `src/app/app/tests/page.tsx`
- `src/app/app/timeline/page.tsx`
- `src/app/app/why/[type]/[id]/page.tsx`
- `src/app/auth/page.tsx`
- `src/app/docs/page.tsx`
- `src/app/globals.css`
- `src/app/join/[code]/page.tsx`
- `src/app/manifest.ts`
- `src/app/offline/page.tsx`
- `src/app/onboarding/onboarding-form.tsx`
- `src/app/page.tsx`
- `src/components/nav.tsx`
- `src/components/public-chrome.tsx`
- `src/components/ui.tsx`
- `src/lib/i18n.ts`
- `src/modules/billing/entitlements.ts`
- `src/server/actions.ts`
- `src/server/evidence.ts`

## Design rules future work must keep

- Student authorship and source provenance remain visually distinguishable.
- Capture asks for the missing human context, not metadata the system already knows.
- Today is not a productivity dashboard.
- Evidence quality beats raw activity counts.
- AI is contextual and source-linked, never the product's giant center panel.
- Graphs are bounded/focused and always have a timeline/text escape hatch.
- Motion explains capture/link/state change; no gratuitous hover lift, keyboard animation or confetti.
- Mobile optimizes capture; desktop optimizes understanding.
- Policy restrictions explain **why**, rather than merely showing “disabled”.
- Private-by-default is visible in onboarding and output flows.

## Recommended next implementation pass after full build verification

1. Fix any real TypeScript/lint/build issues exposed after dependencies install.
2. Add Storybook and axe only after the baseline framework build is green.
3. Replace hand-built graph layout with React Flow + ELK only when adding that dependency is justified and lockfile/reproducibility are restored.
4. Add visual regression screenshots for Today, Capture, 30-second Why, Timeline, Decision, Competition Mode and mobile navigation.
5. Test the capture/Why flow on a real phone with keyboard, offline mode and slow connectivity.
6. Test with real pilot evidence and tune density from observed use rather than adding decorative UI.

## Source archive safety

The original uploaded repository was not modified. All work was performed in the separate build copy delivered with this handoff.
