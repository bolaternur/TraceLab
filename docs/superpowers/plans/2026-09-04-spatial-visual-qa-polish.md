# Spatial Visual QA & Composition Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make TraceLab's Spatial Home visually read like a Google Stitch+n8n-inspired engineering canvas rather than a dashboard rendered on top of React Flow.

**Architecture:** Preserve the existing WorkbenchSnapshot, React Flow state, capture pipeline, route semantics, and evidence relationships. Change only visual composition and presentation primitives: board geometry, board internals, floating chrome, inspector treatment, and responsive fit behavior. Keep the spatial world dark and calm while making evidence workboards feel like independent white engineering artboards.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind 4, React Flow 12, Motion 12, Zustand, existing TraceLab tokens.

**Spec:** `/mnt/data/TraceLab_SPATIAL_WORKBENCH_DESIGN_SPEC.md`

## Global Constraints

- No generic SaaS KPI dashboard on `/app`.
- No bento-grid page layout; boards live in spatial coordinates.
- No glassmorphism, decorative gradients, perpetual animation, hover lift, or hover scale.
- Evidence/provenance/policy semantics remain server-authoritative and unchanged.
- `prefers-reduced-motion` remains fully supported.
- Mobile remains focused/snap-based rather than a miniature infinite canvas.
- The main visual hierarchy is Active Iteration → missing human context → evidence/test/decision.

---

### Task 1: Visual composition contracts and geometry

**Files:**
- Modify: `tests/frontend-contract.node.test.ts`
- Modify: `tests/workbench-model.node.test.ts`
- Modify: `src/components/workbench/layout.ts`

**Interfaces:**
- Produces a stable, asymmetrical composition with Active Iteration as the largest central board.

- [x] Add failing contracts for central hero iteration, wider spacing, and non-dashboard board composition.
- [x] Run contract/model tests and confirm RED.
- [x] Update board geometry and layout version.
- [x] Run model tests and confirm GREEN.

### Task 2: Artboard visual system

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/workbench/workboard-node.tsx`
- Modify: `scripts/frontend-static-audit.mjs`

**Interfaces:**
- Produces flat/light engineering artboards with restrained shadows and no full-height decorative accent stripe.

- [x] Add failing contract/audit rules for artboard treatment.
- [x] Run checks and confirm RED.
- [x] Implement restrained artboard border/shadow/header/accent treatment.
- [x] Run checks and confirm GREEN.

### Task 3: Replace dashboard/list internals with evidence compositions

**Files:**
- Modify: `src/components/workbench/workboard-content.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Keeps all canonical links and data while changing the visual hierarchy from lists/KPIs to tiles, traces, and compact evidence clusters.

- [x] Add failing contracts banning the Active Iteration KPI grid and requiring source/why/test/decision trace composition.
- [x] Run contracts and confirm RED.
- [x] Recompose Needs Context, Active Iteration, Recent Evidence, Test Bench, Decision Trail, and Process Health.
- [x] Run contracts and confirm GREEN.

### Task 4: Split floating chrome

**Files:**
- Modify: `src/components/workbench/workbench-top-bar.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Produces separate project-context and action/status clusters instead of one full-width toolbar.

- [x] Add failing contract for split floating chrome.
- [x] Run contracts and confirm RED.
- [x] Implement project context pill + compact action cluster.
- [x] Run contracts and confirm GREEN.

### Task 5: Unified dark inspector

**Files:**
- Modify: `src/components/workbench/inspector-host.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Workbench inspector visually belongs to the same dark world as Trace/Timeline inspectors while preserving accessible contrast.

- [x] Add failing contract for dark inspector structure.
- [x] Run contracts and confirm RED.
- [x] Implement dark inspector, light evidence surfaces only where needed.
- [x] Run audit/contracts and confirm GREEN.

### Task 6: Viewport and responsive fit polish

**Files:**
- Modify: `src/components/workbench/spatial-canvas.tsx`
- Modify: `src/components/workbench/mobile-workbench.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Desktop opens with the hero composition comfortably framed at 1366–1920 widths; mobile preserves the same hierarchy in focused cards.

- [x] Add failing contract for hero-first fit/zoom constraints and mobile hierarchy.
- [x] Run contracts and confirm RED.
- [x] Tune fitView max zoom/padding and mobile board ordering/spacing.
- [x] Run contracts/audit and confirm GREEN.

### Task 7: Final visual hardening and handoff

**Files:**
- Modify: `scripts/frontend-static-audit.mjs`
- Create: `SPATIAL_VISUAL_PHASE_G_HANDOFF.md`

**Interfaces:**
- Ensures future changes cannot silently reintroduce KPI grids, full-width chrome, heavy artboard shadows, glass blur, or motion decoration.

- [x] Run full `npm run frontend:verify`.
- [x] Run hygiene/secret scan.
- [x] Probe npm registry and run framework gate if available.
- [x] Write final handoff with exact verification results and local browser QA checklist.
- [x] Package ZIP, run `unzip -t`, and record SHA-256.


## Environment note

The package-registry probe was attempted with a hard timeout and did not complete in this container. Full `npm install`, `typecheck`, `lint`, Vitest, and Next production build remain a local-machine verification gate.
