# Spatial Engineering Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace `/app/timeline`'s long grouped list with a spatial horizontal engineering time surface that preserves real source/test/decision/iteration chronology, exposes iteration causality, shares the Spatial Workbench interaction language, and retains a mobile/semantic chronological fallback.

**Architecture:** `subsystemTimeline()` remains the authoritative server query. The route normalizes its rows once into a serializable `EngineeringTimelineSnapshot`, then hands that snapshot to a narrow client island. Desktop uses a custom horizontal time surface rather than React Flow: fixed-size event cards are positioned on a time axis, density changes pixels-per-time and source-event aggregation, iteration membership renders as non-authoritative visual bands, and selection opens a docked inspector. Mobile and screen-reader paths keep chronological semantic lists.

**Tech Stack:** Next.js 16 Server Components, React 19 client islands, TypeScript 5.9, Motion 12 for inspector/camera-like focus transitions, existing TraceLab tokens/components, native scroll/ResizeObserver for the time surface, Node dependency-free contract/model tests.

**Spec:** `docs/superpowers/specs/2026-09-04-spatial-workbench-design.md` §16 and `docs/superpowers/specs/2026-09-04-tracelab-frontend-design.md` §6.4.

## Global Constraints

- `subsystemTimeline()` remains server-authoritative; client code never invents evidence, test results, decisions, authorship, or relations.
- Raw Drizzle `Date` objects do not cross into the client timeline; all temporal values are normalized to ISO strings at the server/client boundary.
- Desktop Timeline is a distinct analytical route from Evidence Trace: time determines x-position; causal iteration membership is a visual overlay, not graph topology.
- Timeline cards retain fixed semantic sizes across scale changes. Scale changes time spacing, tick granularity, and source-event density.
- Desktop supports subsystem/date filters, selection, focus/scroll-to-event, inspector, keyboard traversal, and links to Evidence Trace.
- Mobile uses a chronological vertical/focused representation; do not embed a miniature horizontal infinite canvas.
- Every spatial representation has a semantic chronological alternative usable by keyboard and screen readers.
- Motion explains focus/selection state only; no perpetual pulses, floating cards, shimmer, or animated trace lines.
- Respect `prefers-reduced-motion`.
- Preserve existing deep links and query filtering behavior.
- Keep every new file focused and avoid adding another global state library for Timeline.

---

## File Map

**Create**
- `src/components/engineering-timeline/types.ts` — serializable timeline domain/view types.
- `src/components/engineering-timeline/model.ts` — date normalization, snapshot construction, density aggregation, deep-link-safe selection helpers.
- `src/components/engineering-timeline/layout.ts` — deterministic x/y layout, ticks, collision tracks, iteration bands.
- `src/components/engineering-timeline/timeline-surface.tsx` — desktop horizontal time surface and keyboard/focus behavior.
- `src/components/engineering-timeline/timeline-event-card.tsx` — fixed-size semantic event visual.
- `src/components/engineering-timeline/timeline-inspector.tsx` — selected-event details and cross-links.
- `src/components/engineering-timeline/timeline-controls.tsx` — scale/fit/help controls.
- `src/components/engineering-timeline/timeline-mobile.tsx` — chronological mobile/focused representation.
- `src/components/engineering-timeline/timeline-list.tsx` — semantic chronological fallback for accessibility and dense review.
- `src/app/app/timeline/timeline-view.tsx` — client composition of surface + inspector + fallback.
- `tests/engineering-timeline-model.node.test.ts` — pure normalization/layout/density regression tests.

**Modify**
- `src/server/evidence.ts` — enrich authoritative timeline items with `iterationId`, `subsystemId`, `provider`, `eventType` while retaining the same source query and hrefs.
- `src/app/app/timeline/page.tsx` — build one snapshot on the server; retain filters; render the new TimelineView.
- `src/components/workbench/secondary-route-frame.tsx` — give `/app/timeline` the same wide spatial route frame as `/app/graph`.
- `src/app/globals.css` — timeline surface/ticks/bands/cards/inspector/mobile styles.
- `tests/frontend-contract.node.test.ts` — structural contracts for the new route and accessibility behavior.
- `package.json` — add timeline model test to `frontend:model`.

---

### Task 1: Serializable Timeline Snapshot Boundary

**Files:**
- Create: `src/components/engineering-timeline/types.ts`
- Create: `src/components/engineering-timeline/model.ts`
- Modify: `src/server/evidence.ts`
- Create: `tests/engineering-timeline-model.node.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes authoritative `subsystemTimeline()` item rows.
- Produces `buildEngineeringTimelineSnapshot(input): EngineeringTimelineSnapshot` with ISO timestamps and stable sorted entries.
- Produces `timelineDeepLink(entry)` by preserving each server-provided `href`.

- [x] **Step 1: Write failing tests** for absent/invalid/Date/string timestamps, snapshot serialization, stable chronological order, and preservation of `iterationId`, `provider`, `eventType`, and `href`.
- [x] **Step 2: Run** `node --experimental-strip-types --test tests/engineering-timeline-model.node.test.ts` and confirm RED because the new module does not exist.
- [x] **Step 3: Implement types/model** with `toTimelineIso()` returning `null` for invalid temporal input and `buildEngineeringTimelineSnapshot()` rejecting rows without id/kind/title/time.
- [x] **Step 4: Enrich `subsystemTimeline()`** so each source/test/decision/iteration item exposes stable semantic metadata without changing filtering/order/database authority.
- [x] **Step 5: Add the model test file to `frontend:model`** and run the model suite GREEN.

---

### Task 2: Density Model and Burst Aggregation

**Files:**
- Modify: `src/components/engineering-timeline/model.ts`
- Modify: `src/components/engineering-timeline/types.ts`
- Modify: `tests/engineering-timeline-model.node.test.ts`

**Interfaces:**
- Produces `TimelineScale = "month" | "day" | "detail"`.
- Produces `buildTimelineDensity(snapshot, scale): TimelineDisplayEntry[]` where fixed-size event entries may become source-burst summaries only at coarser scales.

- [x] **Step 1: Write RED tests** proving `detail` retains every entry, `day` only aggregates dense source-event bursts, `month` aggregates same-day source noise, and tests/decisions/iteration boundaries are never collapsed into bursts.
- [x] **Step 2: Implement deterministic aggregation** keyed by scale + UTC/local day bucket + iteration membership. Burst summaries expose count, first/last timestamp, provider labels, and member ids.
- [x] **Step 3: Verify** density tests GREEN and stable under reversed input order.

---

### Task 3: Deterministic Horizontal Layout + Iteration Bands

**Files:**
- Create: `src/components/engineering-timeline/layout.ts`
- Modify: `src/components/engineering-timeline/types.ts`
- Modify: `tests/engineering-timeline-model.node.test.ts`

**Interfaces:**
- Produces `layoutEngineeringTimeline(snapshot, scale, options)` returning positioned fixed-size entries, time ticks, lane bounds, canvas dimensions, and iteration bands.
- Lanes: `source`, `iteration`, `test`, `decision`.

- [x] **Step 1: Write RED tests** proving chronological x ordering, fixed card width/height across scales, wider temporal distance at finer scale, deterministic collision tracks, finite coordinates, and iteration bands spanning only known members.
- [x] **Step 2: Implement scale geometry** using constant event dimensions and scale-specific pixels-per-hour/day; clamp extreme gaps so seasons remain navigable.
- [x] **Step 3: Implement lane collision tracks** so overlapping cards stack vertically inside their semantic lane rather than overlap.
- [x] **Step 4: Implement iteration bands** from entries sharing `iterationId`, using the matching iteration-open title when available; bands are presentation-only and do not mutate chronology or relation data.
- [x] **Step 5: Run pure model/layout tests GREEN.**

---

### Task 4: Desktop Spatial Timeline Surface

**Files:**
- Create: `src/components/engineering-timeline/timeline-event-card.tsx`
- Create: `src/components/engineering-timeline/timeline-controls.tsx`
- Create: `src/components/engineering-timeline/timeline-surface.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- `TimelineSurface({ snapshot, initialScale, selectedId, onSelect })` owns scroll/focus mechanics but not server data.
- `TimelineEventCard` renders a fixed-size event/burst card and calls `onSelect`.

- [x] **Step 1: Add RED frontend contracts** for a horizontal surface, fixed semantic lanes, time ticks, scale controls, iteration bands, no React Flow dependency, and reduced-motion-aware focus.
- [x] **Step 2: Implement dark graphite time surface** with quiet grid/ticks, sticky lane labels, fixed-size cards, iteration bands behind cards, and no generic dashboard grid.
- [x] **Step 3: Add controls** for Month / Day / Detail, Fit history, Today/latest, and keyboard help.
- [x] **Step 4: Add interaction**: click selects, Enter focuses selected, Up/Down moves chronologically, Left/Right scrolls time, F/0 fits history, Esc clears focus/selection. Editable targets must be ignored.
- [x] **Step 5: Use Motion/reduced-motion only for selection/focus affordance; native scrolling stays direct and interruptible.**
- [x] **Step 6: Run contracts GREEN.**

---

### Task 5: Timeline Inspector and Cross-Surface Bridges

**Files:**
- Create: `src/components/engineering-timeline/timeline-inspector.tsx`
- Modify: `src/components/engineering-timeline/timeline-surface.tsx`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- `TimelineInspector({ snapshot, selectedId, onClose })` exposes provenance-ish timeline metadata, iteration membership, direct entity deep link, and filtered Evidence Trace link.

- [x] **Step 1: Add RED contracts** requiring selected event title/kind/time/detail, iteration context, `Inspect` deep link, `Open in Trace`, and an explicit close control.
- [x] **Step 2: Implement a 340–390px docked inspector** visually aligned with Evidence Trace inspector. Do not place it inside the transformed/scrolled time canvas.
- [x] **Step 3: Build `Open in Trace` URLs** using subsystem where available and entity focus where the Trace route supports it; never invent graph relations.
- [x] **Step 4: Verify contracts GREEN.**

---

### Task 6: Mobile + Semantic Chronological Fallback

**Files:**
- Create: `src/components/engineering-timeline/timeline-mobile.tsx`
- Create: `src/components/engineering-timeline/timeline-list.tsx`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Mobile receives the same `EngineeringTimelineSnapshot` but renders chronological groups/focused cards, not the desktop time canvas.
- Semantic list always exposes ordered `<ol>` content and real links.

- [x] **Step 1: Add RED contracts** asserting mobile contains no React Flow/horizontal mini-canvas, uses chronological ordered semantics, 44px controls, and a bottom inspector/detail action.
- [x] **Step 2: Implement mobile chronological cards** grouped by local day, with compact iteration markers and an on-demand bottom-sheet inspector.
- [x] **Step 3: Implement desktop semantic list fallback** below the canvas using headings/time/order and real entity links; visually collapsible but present in the accessibility tree only when expanded by the user.
- [x] **Step 4: Verify contracts and static accessibility audit GREEN.**

---

### Task 7: Route Migration and Spatial Frame

**Files:**
- Create: `src/app/app/timeline/timeline-view.tsx`
- Modify: `src/app/app/timeline/page.tsx`
- Modify: `src/components/workbench/secondary-route-frame.tsx`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Server route calls `subsystemTimeline()` once, normalizes once, and passes serializable `snapshot` + timezone + scale into the client TimelineView.
- Existing subsystem/from/to/zoom URL filters remain compatible; `detail` becomes an additional scale value.

- [x] **Step 1: Add RED route contracts** requiring `buildEngineeringTimelineSnapshot`, `<TimelineView`, no old `<TimelineGroup`, preserved subsystem/date filters, and wide spatial route framing.
- [x] **Step 2: Rewrite page composition** with concise spatial header, Home/Trace bridges, existing filter controls, and one normalized snapshot client boundary.
- [x] **Step 3: Update SecondaryRouteFrame** so `/app/timeline` uses the full-height/wide power-view treatment like `/app/graph`.
- [x] **Step 4: Run all frontend contracts GREEN.**

---

### Task 8: Verification, Handoff, and Packaging

**Files:**
- Create: `SPATIAL_TIMELINE_PHASE_D_HANDOFF.md`
- Modify: `docs/frontend/THIRD_PARTY_SOURCE_LEDGER.md` only if any third-party code is adapted; ordinary dependency usage needs no copied-code entry.

**Interfaces:**
- Produces a reproducible Phase D checkpoint archive containing A+B+C+D.

- [x] **Step 1: Run** `npm run frontend:verify` and record exact contract/model/audit/syntax counts.
- [x] **Step 2: Attempt** `npm view next version` (or equivalent registry probe). If registry works, run `npm install`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`; if network remains unavailable, record the exact blocker without claiming these gates passed.
- [x] **Step 3: Write handoff** with architecture, interaction keys, route behavior, preserved backend semantics, migration commands, known limitations, and verification evidence.
- [x] **Step 4: Create ZIP**, run `unzip -t`, calculate SHA-256, and expose both archive and handoff.

---

## Self-Review

- Spec coverage: desktop horizontal surface, lane grouping, density scale, iteration causality, inspector, mobile chronological fallback, subsystem/date filters, semantic alternative, reduced motion, and Trace bridge are each mapped to a task.
- Scope boundary: Capture is intentionally excluded and receives its own next-phase plan; Timeline does not become a graph editor.
- Type consistency: `EngineeringTimelineSnapshot`, `TimelineScale`, `TimelineDisplayEntry`, and `layoutEngineeringTimeline()` are defined before any consuming UI task.
- Runtime boundary: every date is normalized before the client boundary; no component may call `.getTime()` on query rows.
- No placeholder implementation steps remain.
