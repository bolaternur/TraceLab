# Spatial Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed TraceLab's existing offline-first capture pipeline into the Spatial Workbench as a fast, contextual capture overlay while preserving `/app/capture` as the full canonical route and preserving all server-authoritative evidence behavior.

**Architecture:** Keep `persistCapture()` and `/api/sync` authoritative. Extract presentation-independent capture metadata/state into pure modules, refactor the current `CaptureSheet` into a reusable composer with `route` and `overlay` variants, and mount it from a Workbench `CaptureLauncher`. Overlay saves continue to enter IndexedDB first; successful sync triggers `router.refresh()` so the server-normalized Workbench snapshot updates, then a transient client-only highlight points to the affected workboard.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, TypeScript 5.9.x, IndexedDB outbox, Motion 12.35.0, Zustand, existing TraceLab server actions and `/api/sync`.

**Spec:** `/mnt/data/TraceLab_SPATIAL_WORKBENCH_DESIGN_SPEC.md` sections 5, 17, 18, 24.

## Global Constraints

- Do not duplicate or bypass `persistCapture()` server authorization, validation, provenance, test/decision creation, or relation creation.
- Always persist a capture to IndexedDB before attempting network sync.
- Preserve stable `clientId` idempotency across retries.
- Preserve client image re-encode and server JPEG metadata stripping.
- `/app/capture` remains canonical and fully usable without the Workbench.
- Overlay may expose only fields already supported by the canonical capture schema.
- Student rationale/reflection remains explicitly student-authored; AI does not generate or silently rewrite it.
- Desktop overlay must not become a second page-sized modal. Complex/expanded test and decision detail links to `/app/capture?...`.
- Mobile capture uses a bottom-sheet/full-screen composition, not a miniature spatial canvas.
- Motion explains launcher → composer → saved state; no hover lift, perpetual pulse, shimmer, or animated background.
- `prefers-reduced-motion` disables morph/slide movement while preserving state changes.
- Existing `/app/capture?kind=&iteration=&subsystem=` deep links remain valid.

---

### Task 1: Capture model and overlay state contract

**Files:**
- Create: `src/components/capture/model.ts`
- Create: `src/components/capture/state.ts`
- Create: `tests/spatial-capture-model.node.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `CaptureKind`, `CAPTURE_KINDS`, `capturePrompt(kind)`, `captureDestination(kind)`, `validateCaptureDraft(kind, fields, hasPhoto)`.
- Produces `CaptureOverlayState`, `initialCaptureOverlayState`, and `reduceCaptureOverlayState(state, action)`.
- Later tasks consume these pure types from client components without importing browser APIs.

- [x] **Step 1: Write failing pure model tests** covering all five existing kinds, mandatory photo/rationale rules, overlay open/select/close/save transitions, and destination workboard mapping.
- [x] **Step 2: Run `node --experimental-strip-types --test tests/spatial-capture-model.node.test.ts`** and verify module-not-found / missing-export failures.
- [x] **Step 3: Implement the minimal pure model and reducer** with no React/browser imports.
- [x] **Step 4: Re-run the model test** and require zero failures.
- [x] **Step 5: Add the test to `frontend:model`** so `npm run frontend:verify` always covers capture state.

### Task 2: Extract reusable offline-first capture controller

**Files:**
- Create: `src/components/capture/use-capture-controller.ts`
- Modify: `src/app/app/capture/capture-sheet.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- `useCaptureController({ teamId, kind, onSaved })` owns online state, IndexedDB outbox state, sync/retry, preview lifecycle, submission, and toast state.
- It returns `submit(form, file)`, `pending`, `failed`, `online`, `busy`, `toast`, `preview`, `setPreview`, `trySync`, `fileRef`.
- It must still call `prepareImage`, `outbox.add`, then `syncOutbox` in that order.

- [x] **Step 1: Add a failing contract** asserting the local-first order and no direct call from capture UI to `persistCapture()`.
- [x] **Step 2: Run the frontend contract suite and observe the expected failure.**
- [x] **Step 3: Extract the controller** from the existing `CaptureSheet` without changing server semantics.
- [x] **Step 4: Make `CaptureSheet` use the controller** and preserve all current route behavior.
- [x] **Step 5: Run capture contract + full dependency-free verification.**

### Task 3: Turn CaptureSheet into route/overlay composer

**Files:**
- Modify: `src/app/app/capture/capture-sheet.tsx`
- Create: `src/components/capture/capture-kind-picker.tsx`
- Create: `src/components/capture/capture-form-fields.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- `CaptureSheet` accepts `variant?: "route" | "overlay"`, `initialKind`, `initialIteration`, `initialSubsystem`, `onSaved?`, and `onRequestClose?`.
- `route` preserves the full form and expandable experimental detail.
- `overlay` keeps the fast essential fields visible; `Test` and `Decision` include an `Open full capture` deep link for advanced detail.

- [x] **Step 1: Add failing contracts** for overlay variant, five kinds, canonical full-route escape, student-authored copy, and optional context selectors.
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Extract kind picker and field renderer** without changing form field names used by `captureSchema`.
- [x] **Step 4: Implement compact overlay composition** with the same input names and same controller.
- [x] **Step 5: Verify GREEN and run syntax/a11y audits.**

### Task 4: Workbench CaptureLauncher and morphing overlay

**Files:**
- Create: `src/components/workbench/capture-launcher.tsx`
- Create: `src/components/workbench/capture-overlay.tsx`
- Modify: `src/components/workbench/workbench-shell.tsx`
- Modify: `src/components/workbench/workbench-top-bar.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- `CaptureLauncher` opens a compact chooser: Photo, Problem, Test, Decision, Reflection.
- Selecting a kind opens `CaptureOverlay` with `CaptureSheet variant="overlay"`.
- `Escape` closes chooser/composer unless submission is actively saving.
- Top-bar Capture triggers the same launcher state rather than route navigation on desktop.

- [x] **Step 1: Add failing contracts** for launcher, kind chooser, shared overlay, no duplicated mutation code, reduced-motion path, and 44px minimum controls.
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Implement launcher and overlay** using Motion only for state transition, with reduced-motion fallback.
- [x] **Step 4: Mount once in `WorkbenchShell`** and wire TopBar to it through a narrow callback/context rather than global DOM events.
- [x] **Step 5: Verify GREEN and run accessibility audit.**

### Task 5: Post-save refresh and structural board highlight

**Files:**
- Modify: `src/components/workbench/store.ts`
- Modify: `src/components/workbench/state.ts`
- Modify: `src/components/workbench/workboard-node.tsx`
- Modify: `src/components/workbench/capture-overlay.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/spatial-capture-model.node.test.ts`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Add transient `recentlyUpdatedBoard: WorkboardKind | null` presentation state with clear action.
- Map Photo/Problem/Reflection → `recent-evidence`; Test → `test-bench`; Decision → `decision-trail`.
- On saved/synced-or-local-persisted capture: call `router.refresh()`, close overlay, set the mapped board highlight, clear it after a short non-authoritative presentation interval.

- [x] **Step 1: Add failing reducer/model tests** for destination mapping and transient highlight state.
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Implement store state and workboard data attribute** for one-shot highlight.
- [x] **Step 4: Wire overlay success to `router.refresh()` and highlight.**
- [x] **Step 5: Add a 180–240 ms structural border/accent transition** and reduced-motion-safe static state; no bounce/pulse.
- [x] **Step 6: Verify GREEN.**

### Task 6: Mobile capture bottom sheet

**Files:**
- Modify: `src/components/workbench/mobile-workbench.tsx`
- Modify: `src/components/workbench/capture-launcher.tsx`
- Modify: `src/components/workbench/capture-overlay.tsx`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Mobile gets a persistent primary Capture action that opens the same kind chooser/composer in bottom-sheet/full-screen form.
- It reuses the same `CaptureSheet variant="overlay"` and outbox controller.
- No React Flow canvas is mounted just to capture on mobile.

- [x] **Step 1: Add failing mobile contracts** for primary Capture, bottom sheet/full-screen semantics, 44px targets, and no duplicate nav stack.
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Implement mobile launcher trigger and responsive overlay geometry.**
- [x] **Step 4: Ensure photo input still uses `capture="environment"`.**
- [x] **Step 5: Verify GREEN with static audit.**

### Task 7: Offline/sync resilience and media lifecycle hardening

**Files:**
- Modify: `src/components/capture/use-capture-controller.ts`
- Modify: `src/lib/outbox.ts`
- Test: `tests/spatial-capture-model.node.test.ts`
- Test: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Failed sync remains in IndexedDB with attempts/error.
- Object URLs created for photo preview are revoked on replacement/unmount.
- Sync does not resend items already marked `syncing`.
- `onSaved` receives `{ clientId, kind, syncState: "synced" | "local" }` after local persistence succeeds, even if network sync fails.

- [x] **Step 1: Add failing contracts/model checks** for local-success semantics and object URL cleanup structure.
- [x] **Step 2: Verify RED.**
- [x] **Step 3: Implement cleanup and explicit local/synced result contract.**
- [x] **Step 4: Keep server-side EXIF and authorization untouched.**
- [x] **Step 5: Run full dependency-free verification.**

### Task 8: Phase E verification, handoff, and packaging

**Files:**
- Create: `SPATIAL_CAPTURE_PHASE_E_HANDOFF.md`
- Modify: `docs/frontend/THIRD_PARTY_SOURCE_LEDGER.md` only if new third-party source code is adapted.

**Interfaces:**
- Deliver a complete A+B+C+D+E archive with no `.env`, `.env.local`, `.next`, `node_modules`, or database data.

- [x] **Step 1: Run `npm run frontend:verify`.** Record exact pass/fail counts.
- [x] **Step 2: Probe npm registry.** If available, run `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; if unavailable, record the exact network error without claiming runtime/build verification.
- [x] **Step 3: Scan for secrets/build artifacts** and exclude them from packaging.
- [x] **Step 4: Write handoff** describing architecture, preserved server semantics, known verification limits, and migration from Phase D.
- [x] **Step 5: Create ZIP, run `unzip -t`, and calculate SHA-256.**
