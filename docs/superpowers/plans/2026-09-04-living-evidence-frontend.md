# Living Evidence Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing TraceLab functional MVP into a coherent Living Evidence Lab frontend while preserving domain logic, provenance, policy gates, offline capture, and tenant boundaries.

**Architecture:** Keep the existing Next.js/React/Tailwind application and server/domain layer. Build a semantic frontend layer around evidence objects, a context-first Today screen, workshop capture, 30-second Why, engineering timeline, bounded trace view, policy-aware outputs, and process-health views. Avoid new runtime dependencies until the repository can install packages again; the current pass uses dependency-free React/Tailwind components and keeps the code ready for later Base UI/shadcn adoption.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, TypeScript 5.9, Drizzle ORM, existing server actions, Node contract tests.

**Spec:** `/mnt/data/TraceLab_FRONTEND_PREBUILD_SPEC_v2.md` and `/mnt/data/DESIGN (1).md`

## Global Constraints

- Preserve student authorship and provenance; never silently rewrite student evidence.
- Keep Capture local-first/offline-first and preserve the existing IndexedDB outbox behavior.
- Keep competition policy restrictions visible and explain why restricted actions are blocked.
- Mobile is optimized for Capture/quick context; desktop is optimized for history/relationships/exports.
- Avoid vanity metrics, leaderboards, generic AI-chat identity, glassmorphism, and generic SaaS dashboard metaphors.
- Respect `prefers-reduced-motion`, WCAG AA contrast, keyboard navigation, and 44x44 minimum touch targets.
- Do not add dependencies that require registry access during this pass.

---

### Task 1: Finish the app shell and command navigation

**Files:**
- Create: `src/components/tracelab/command-palette.tsx`
- Modify: `src/app/app/layout.tsx`
- Modify: `src/components/nav.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Consumes: `NavGroup[]`, capture href, Today href.
- Produces: keyboard-accessible `CommandPalette` supporting search/navigation and `Ctrl/Cmd+K`.

- [ ] Write a failing contract test for command-palette presence and keyboard shortcut.
- [ ] Run the contract suite and confirm the new test fails.
- [ ] Implement the dependency-free command palette.
- [ ] Run contract tests and syntax checks.

### Task 2: Add dedicated decision detail

**Files:**
- Create: `src/app/app/decisions/[id]/page.tsx`
- Modify: `src/app/app/decisions/page.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Consumes: `decisions`, `annotations`, `relations`, `tests`, `iterations`, existing `addAnnotation` and `addRelation` actions.
- Produces: evidence-first decision detail with student rationale, linked tests/evidence, causal outcome, authorship, and source history links.

- [ ] Write failing contract tests for `/app/decisions/[id]` and decision-list links.
- [ ] Run to verify RED.
- [ ] Implement the detail route and update list links.
- [ ] Run contract tests and syntax checks.

### Task 3: Make Tests and Decisions semantic list surfaces

**Files:**
- Modify: `src/app/app/tests/page.tsx`
- Modify: `src/app/app/decisions/page.tsx`
- Modify: `src/components/ui.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces: readable object rows with type/ID/result/relationship state instead of generic card/table treatment.

- [ ] Add failing contracts for evidence semantic labels and relationship context.
- [ ] Implement focused list treatments while preserving queries and filters.
- [ ] Verify contracts and syntax.

### Task 4: Refine Competition Mode

**Files:**
- Modify: `src/app/app/competition/page.tsx`
- Modify: `src/app/app/competition/policy-forms.tsx` only if required.
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces: active policy-pack summary, trust guarantees, explicit restricted-action explanation, policy update state, and detailed source/version history.

- [ ] Add failing contract for policy pack summary and restricted-action explanation.
- [ ] Implement policy-first hierarchy.
- [ ] Verify contracts and syntax.

### Task 5: Refine export composer and preview

**Files:**
- Modify: `src/app/app/exports/page.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces: evidence readiness + output selector + preview/trust-check split layout using existing export actions.

- [ ] Add failing contract for output selector and preview/trust checks.
- [ ] Implement without changing export generation logic.
- [ ] Verify contracts and syntax.

### Task 6: Replace coach KPI dashboard with intervention-oriented process health

**Files:**
- Create: `src/components/tracelab/process-health-card.tsx`
- Modify: `src/app/app/coach/page.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces: process-health summary and intervention cards; no per-student scores or generic metric grid.

- [ ] Add failing contract rejecting generic `Metric` grid on Coach.
- [ ] Implement process-health cards and structural intervention sections.
- [ ] Verify contracts and syntax.

### Task 7: Refine cross-season handoff

**Files:**
- Modify: `src/app/app/handoff/page.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces: “Start here next season” framing, major decisions, proven tests, known failures, unresolved questions, and direct timeline links.

- [ ] Add failing contract for “Start here next season” and removal of “Time Machine” wording.
- [ ] Implement hierarchy and copy changes.
- [ ] Verify contracts and syntax.

### Task 8: Static accessibility and semantic QA

**Files:**
- Modify any changed frontend files as required.
- Create: `scripts/frontend-static-audit.mjs`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces: dependency-free checks for reduced motion, skip link, button labels, image alt text, form labels, no obvious banned visual/copy patterns.

- [ ] Write the audit script and run it.
- [ ] Fix findings.
- [ ] Re-run Node contracts and TS syntax/transpile checks.

### Task 9: Handoff and packaging

**Files:**
- Create: `FRONTEND_HANDOFF.md`
- Create: final ZIP outside project tree.

**Interfaces:**
- Produces: exact run/verification commands, changed-surface summary, environment limitation, next recommended dependency migration.

- [ ] Record fresh verification outputs.
- [ ] Write handoff without claiming unavailable build verification.
- [ ] Package `/mnt/data/tracelab_frontend_build` as a ZIP.
