# TraceLab Frontend Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the existing TraceLab frontend foundation and the Today → Capture/Why → Timeline vertical slice into the Living Evidence Lab design while preserving existing evidence, policy, tenancy, and offline behavior.

**Architecture:** Keep Next.js Server Components and all existing server/domain modules. Introduce a small TraceLab presentation layer with design tokens, domain UI models, semantic evidence components, and a redesigned responsive shell. Client-side state remains narrow: mobile nav and Capture keep their current client boundaries; no new runtime UI library is required for this first slice because npm registry access is unavailable in the execution environment.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, existing IndexedDB outbox. Future-ready seams are preserved for Base UI, Motion, React Flow/ELK, and Phosphor once dependencies can be installed.

**Spec:** `docs/superpowers/specs/2026-09-04-tracelab-frontend-design.md`

## Global Constraints

- Preserve existing domain/server/offline behavior; do not rewrite policy, tenancy, storage, or evidence ingestion.
- Product identity is Living Evidence Lab: work → why → evidence → decision → next iteration.
- Today is not a KPI dashboard; missing human context is the highest-priority object.
- The primary mobile action is Capture.
- Student authorship, source provenance, policy state, and offline state remain legible.
- Light-first palette: canvas `#F6F7F2`, carbon `#111315`, Trace Blue `#4169FF`, Signal Lime `#C8F36D`, Test Orange `#F5A63C`, Decision Violet `#7567F8`, Verified Green `#378A62`.
- Utility radii 8–12px; evidence objects 16–20px; expressive surfaces 24–32px.
- Core motion timings stay within 100–420ms and respect `prefers-reduced-motion`.
- Do not add a generic dashboard, Kanban, giant AI chat panel, glassmorphism, or decorative gradients.
- No dependency may be copied from an incompatible-license reference repository; references are patterns unless specifically MIT/permissive.
- The uploaded archive has no `.git`; commit steps are recorded but cannot be executed in this sandbox copy.

---

### Task 1: Frontend contract and presentation helpers

**Files:**
- Create: `src/components/tracelab/presentation.ts`
- Create: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces `getSourcePresentation(provider, eventType)`, `getEvidenceTone(kind, outcome)`, `getPrimaryMobileItems(items)`, and `formatTechnicalDate(date)`.
- Later tasks consume these helpers for badges, nav, Today, Capture, and Timeline.

- [ ] Write failing Node tests for source labels, evidence semantic tones, mobile nav ordering, and stable technical date output.
- [ ] Run `node --test --experimental-strip-types tests/frontend-contract.node.test.ts` and confirm RED because the module does not exist.
- [ ] Implement only the pure presentation helpers.
- [ ] Re-run the Node tests and confirm GREEN.

### Task 2: Living Evidence Lab tokens and primitive classes

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui.tsx`

**Interfaces:**
- Consumes the semantic names from Task 1.
- Produces stable classes for `trace-card`, `trace-surface`, `evidence-card`, `trace-button`, `trace-badge`, `trace-meta`, `trace-line`, `trace-chip`, and semantic tone variants.

- [ ] Write a static contract test in `tests/frontend-contract.node.test.ts` that asserts the required token names/classes exist in `globals.css`; verify RED.
- [ ] Replace the old generic palette/radii with the Living Evidence Lab tokens while retaining compatibility aliases used by untouched routes.
- [ ] Upgrade shared badges/headers/empty states to the new semantic classes without changing business behavior.
- [ ] Re-run contract tests.

### Task 3: App shell and navigation hierarchy

**Files:**
- Modify: `src/components/nav.tsx`
- Modify: `src/app/app/layout.tsx`
- Create: `src/components/tracelab/brand-mark.tsx`

**Interfaces:**
- Desktop groups become Today/Capture, Project, Memory, Output, Team utilities.
- Mobile primary nav becomes Today, Timeline, central Capture, Memory with secondary menu for the rest.

- [ ] Extend tests for `getPrimaryMobileItems` to require Today/Timeline/Memory and exclude settings/integrations; verify RED.
- [ ] Implement the new shell hierarchy and name-independent trace mark.
- [ ] Keep server-side team switching, unread count, policy state, and sign-out intact.
- [ ] Re-run tests and static TypeScript syntax checks available in the environment.

### Task 4: Today data model — missing context first

**Files:**
- Modify: `src/server/evidence.ts`
- Create: `src/components/tracelab/today-model.ts`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- `thisWeek()` additionally returns `needsContext`, containing newest inbox/source events that need student classification/rationale.
- `buildTodaySummary()` converts raw counts into compact secondary process context, never vanity KPIs.

- [ ] Write failing tests for Today prioritization and summary behavior.
- [ ] Add the smallest query/data transform needed without changing source-event mutability rules.
- [ ] Re-run tests.

### Task 5: Today redesign

**Files:**
- Create: `src/components/tracelab/missing-context-card.tsx`
- Create: `src/components/tracelab/evidence-row.tsx`
- Create: `src/components/tracelab/process-strip.tsx`
- Modify: `src/app/app/page.tsx`
- Add: `public/evidence/demo-robot.jpg` from the user-provided CAD/media pack for empty/demo visual treatment only.

**Interfaces:**
- `MissingContextCard` consumes a source event and links to the existing inbox/iteration flow.
- `ProcessStrip` shows low-emphasis context such as unresolved inbox/tests/decisions without becoming a KPI hero.

- [ ] Add static contract assertions that Today contains `Needs your context`, Capture, and no metric-grid hero.
- [ ] Build Today hierarchy: date/team context → needs-context queue → one-tap Capture → recently captured/connected evidence → process gaps.
- [ ] Use real uploaded engineering media only where appropriate and never as fake evidence for a real team record.
- [ ] Preserve welcome/policy notices and empty states.

### Task 6: Capture interaction redesign

**Files:**
- Modify: `src/app/app/capture/capture-sheet.tsx`
- Create: `src/components/tracelab/capture-type-card.tsx`
- Create: `src/components/tracelab/sync-status.tsx`

**Interfaces:**
- Keep existing `OutboxItem`, `prepareImage`, `outbox.add`, and `syncOutbox` behavior exactly.
- Presentation changes only: workshop launcher, expressive capture type selection, progressive detail, clearer offline persistence state.

- [ ] Add source-contract test assertions that offline-first outbox calls remain present before network sync.
- [ ] Refactor visual structure around `What happened?`, large mobile-friendly capture choices, and one strong prompt per type.
- [ ] Keep decision rationale required, EXIF stripping, compression, idempotent client IDs, and retry behavior.
- [ ] Re-run tests.

### Task 7: Engineering Timeline redesign

**Files:**
- Create: `src/components/tracelab/timeline-event.tsx`
- Create: `src/components/tracelab/timeline-group.tsx`
- Modify: `src/app/app/timeline/page.tsx`

**Interfaces:**
- Timeline event kinds map to source/revision/test/decision/iteration semantic tones and glyphs.
- Existing server query/filter parameters remain intact.

- [ ] Add failing tests for semantic kind mapping and filter labels.
- [ ] Replace equal-card feed with a causal trace rail, differentiated node shapes/tone labels, denser metadata, and stable filter bar.
- [ ] Keep graph link as a power-view escape hatch rather than default mode.
- [ ] Re-run tests.

### Task 8: Hardening and handoff

**Files:**
- Modify: `README.md`
- Create: `FRONTEND_HANDOFF.md`

**Interfaces:**
- Documents dependency/network limitation, preserved behavior, completed visual slice, and next dependency-enabled work: Base UI primitives, Motion shared transitions, Storybook, React Flow/ELK graph.

- [ ] Run Node contract tests.
- [ ] Run the strongest available static check; record dependency-resolution limitations rather than claiming a full build passed.
- [ ] Search for accidental generic colors/radii and inaccessible tap targets in changed files.
- [ ] Package `/mnt/data/tracelab_frontend_build` into a user-downloadable ZIP.
