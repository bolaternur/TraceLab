# Motion + Spatial Interaction Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make Workbench, Evidence Trace, Engineering Timeline, and Spatial Capture feel like one continuous, responsive spatial system without decorative motion or behavior regressions.

**Architecture:** Introduce one shared motion policy consumed by spatial surfaces and inspector/sheet transitions. Keep React Flow responsible for viewport/node transforms, keep evidence/domain state unchanged, and use Motion only for panel/content/route-surface continuity. Reduced-motion mode must collapse transitions to near-instant state changes.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, Motion 12.35.0, @xyflow/react 12.11.6, Zustand 4.5.7, react-resizable-panels 4.7.0, TypeScript 5.9.3.

**Spec:** `/mnt/data/TraceLab_SPATIAL_WORKBENCH_DESIGN_SPEC.md` §18 Motion System plus `DESIGN (1).md` §34.

## Global Constraints

- Motion explains spatial/state change; it never decorates the product.
- Hover/focus feedback stays within 100–150 ms.
- Selection feedback stays within 120–160 ms.
- Inspector open/close stays within 200–240 ms.
- Focus-camera transitions stay within 240–300 ms and remain interruptible.
- No card hover lift, repeated floating, shimmer, constantly animated edges, or 700–1000 ms route transitions.
- React Flow owns node transforms and camera math; Motion must not animate React Flow node positions.
- `prefers-reduced-motion: reduce` makes camera/panel/edge changes near-instant and removes spring settling.
- Existing auth, PostgreSQL, provenance, capture outbox, policy, and evidence relationships are out of scope.
- Mobile remains focused-board/list based; no miniature desktop infinite canvas.

---

### Task 1: Shared motion policy

**Files:**
- Create: `src/components/spatial-motion/policy.ts`
- Create: `tests/spatial-motion-model.node.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `SPATIAL_MOTION`, `motionDuration()`, `panelTransition()`, and `surfaceTransition()` for all later tasks.

- [x] Write failing tests asserting exact timing bands and reduced-motion zero-duration behavior.
- [x] Run the model test and verify failure because the policy module does not exist.
- [x] Implement the minimal typed motion policy with shared easing and duration constants.
- [x] Add the test file to `frontend:model`.
- [x] Run the model test and `frontend:verify`.

### Task 2: Inspector and bottom-sheet continuity

**Files:**
- Create: `src/components/spatial-motion/presence.tsx`
- Modify: `src/components/workbench/inspector-host.tsx`
- Modify: `src/components/evidence-trace/trace-inspector.tsx`
- Modify: `src/components/engineering-timeline/timeline-inspector.tsx`
- Modify: `src/components/workbench/mobile-workbench.tsx`
- Modify: `src/components/engineering-timeline/timeline-mobile.tsx`
- Modify: `src/components/workbench/capture-overlay.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Consumes shared motion policy.
- Produces reusable `SpatialFadeSwap` and `SpatialBottomSheet` behavior.

- [x] Add failing contracts requiring shared panel timing, reduced-motion handling, and bottom-sheet presence for mobile inspectors.
- [x] Verify RED.
- [x] Implement panel content swap and bottom-sheet motion using Motion; keep DOM semantics and focus targets unchanged.
- [x] Verify contracts and static accessibility audit.

### Task 3: Workbench camera/focus continuity

**Files:**
- Modify: `src/components/workbench/spatial-canvas.tsx`
- Modify: `src/components/workbench/state.ts`
- Test: `tests/workbench-model.node.test.ts`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Keeps selection stationary.
- Focus stores the prior viewport and restores it on Escape.
- New pointer/wheel input can cancel pending camera transitions.

- [x] Add failing reducer/contract tests for explicit focus lifecycle and restore semantics.
- [x] Verify RED.
- [x] Centralize camera durations through shared motion policy and add interrupt guards for pointer/wheel input.
- [x] Verify model/contracts.

### Task 4: Route-surface transition intent

**Files:**
- Create: `src/components/spatial-motion/route-surface.tsx`
- Modify: `src/components/workbench/secondary-route-frame.tsx`
- Modify: `src/components/workbench/tool-rail.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces one restrained spatial route transition for `/app`, `/app/graph`, and `/app/timeline`.
- Does not animate secondary/admin pages as dramatic spatial moves.

- [x] Add failing contract for keyed route surface, maximum 180 ms transition, and reduced-motion behavior.
- [x] Verify RED.
- [x] Implement subtle opacity/6px transition for spatial power views only; no page-scale animation.
- [x] Verify contracts/audit.

### Task 5: Keyboard and gesture polish

**Files:**
- Modify: `src/components/workbench/spatial-canvas.tsx`
- Modify: `src/components/evidence-trace/trace-canvas.tsx`
- Modify: `src/components/engineering-timeline/timeline-surface.tsx`
- Modify: `src/components/workbench/canvas-controls.tsx`
- Modify: `src/components/evidence-trace/trace-controls.tsx`
- Modify: `src/components/engineering-timeline/timeline-controls.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Preserves Space-pan, F/0 fit, 1 reset zoom, Enter focus, Esc restore, and editable-target guards.
- Adds consistent cursor/mode affordances without input lag.

- [x] Add failing contracts for direct pan, editable-target guard, and consistent help/fit keyboard semantics.
- [x] Verify RED.
- [x] Normalize helper functions and interaction data attributes without changing domain behavior.
- [x] Verify contracts/audit.

### Task 6: Responsive and performance motion pass

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/workbench/workboard-node.tsx`
- Modify: `src/components/evidence-trace/trace-node.tsx`
- Modify: `src/components/engineering-timeline/timeline-event-card.tsx`
- Test: `scripts/frontend-static-audit.mjs`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Selection uses border/shadow/opacity only.
- No transform-based hover lift on evidence surfaces.
- Reduced-motion removes nonessential transitions.

- [x] Add failing audit/contract checks against hover-lift, perpetual animation, and long transition duration.
- [x] Verify RED.
- [x] Normalize CSS transitions and responsive motion properties.
- [x] Verify full static gate.

### Task 7: Final verification and handoff

**Files:**
- Create: `SPATIAL_MOTION_PHASE_F_HANDOFF.md`
- Update: `docs/superpowers/plans/2026-09-04-motion-spatial-polish.md`

**Interfaces:**
- Produces a clean A+B+C+D+E+F archive with no local secrets/build cache.

- [x] Run `npm run frontend:verify` on the final tree.
- [x] Probe npm registry and run framework-level gates only if dependencies/network allow.
- [x] Scan for `.env`, `.env.local`, `.next`, `node_modules`, logs, keys, and tsbuildinfo.
- [x] Write exact verification counts and remaining external gate in handoff.
- [x] Package ZIP, run `unzip -t`, and compute SHA-256.

## Self-review

- Spec coverage: timing, reduced motion, inspector, camera continuity, route surface, keyboard/gesture, responsive/performance, and verification are all mapped to tasks.
- Scope: no new product features, no backend/domain refactor, no capture semantic changes.
- Placeholder scan: no implementation placeholders remain.
- Type consistency: all shared motion exports are introduced in Task 1 and consumed later.
