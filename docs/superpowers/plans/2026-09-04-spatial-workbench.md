# TraceLab Spatial Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the authenticated `/app` dashboard mental model with a full-viewport spatial evidence workbench while preserving TraceLab authorization, provenance, policy, offline capture, deep links, and accessible secondary routes.

**Architecture:** Keep `src/app/app/layout.tsx` and route pages as Server Components for authorization and domain loading. Normalize database/query rows into a serializable `WorkbenchSnapshot`, then cross one explicit client boundary into `WorkbenchShell`, where React Flow owns viewport/node interaction and a small Zustand store owns transient selection/focus/inspector state. Coarse workboards summarize real evidence on `/app`; fine-grained evidence topology remains a separate `/app/graph` phase.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, TypeScript 5.9.3, Tailwind CSS 4.1.17, Drizzle ORM/PostgreSQL, `@xyflow/react` 12.11.6, `motion` 12.35.0, `zustand` 4.5.x, `react-resizable-panels` 4.7.0. ELK.js is introduced only in the fine-grained Trace task.

**Spec:** `docs/superpowers/specs/2026-09-04-spatial-workbench-design.md`

## Global Constraints

- `/app` is a Spatial Evidence Workbench, not a dashboard with decorative dots.
- The server remains authoritative for team authorization, policy, provenance, source relations, tests, decisions, iterations, and capture mutations.
- Client state may own only viewport, selection, focus, inspector, minimap, interaction mode, and temporary coarse-board positions.
- Every date crossing the Server Component → Client Component boundary is an ISO string, never a `Date` instance.
- Home workbench uses coarse semantic boards, not one React Flow node per database row.
- Preserve existing deep-link routes for tests, decisions, iterations, inbox, competition, exports, settings, and other secondary views.
- Preserve a semantic/list alternative to any graph-only representation.
- Canvas is graphite (`#202124`) with a quiet dotted grid; boards are light physical surfaces. No gradient/glass/starfield/particle treatment.
- No hover-lift, perpetual pulse/shimmer, decorative edge animation, or slow 700–1000 ms transitions.
- `prefers-reduced-motion` must disable spatially non-essential animation.
- Primary desktop input follows design-tool conventions: wheel/trackpad pan, pinch or Cmd/Ctrl+wheel zoom, Space+drag pan, middle mouse pan, select on primary drag.
- `Enter` focuses a selected board; `Esc` backs out one spatial layer; `0/F` fit project; `1` resets to 100%; `Cmd/Ctrl+K` preserves command palette.
- Mobile does not expose a tiny infinite canvas; it uses focused boards and bottom-sheet/detail navigation.
- Never copy Activepieces EE code; reference only permissively licensed mechanisms documented in the provenance matrix.
- Existing backend behavior must not be rewritten merely to support the new presentation layer.

---

## File Structure Map

### New spatial subsystem

- `src/components/workbench/types.ts` — serializable workbench/domain presentation types.
- `src/components/workbench/snapshot.ts` — pure adapters from server query rows to `WorkbenchSnapshot`.
- `src/components/workbench/layout.ts` — deterministic coarse-board positions and extent calculation.
- `src/components/workbench/store.ts` — transient Zustand canvas state only.
- `src/components/workbench/workbench-shell.tsx` — top-level client boundary and desktop/mobile composition.
- `src/components/workbench/spatial-canvas.tsx` — React Flow configuration and event bridge.
- `src/components/workbench/workboard-node.tsx` — base custom node chrome.
- `src/components/workbench/workboard-content.tsx` — kind-specific board content.
- `src/components/workbench/tool-rail.tsx` — compact primary spatial navigation.
- `src/components/workbench/workbench-top-bar.tsx` — team/project/policy/sync context.
- `src/components/workbench/canvas-controls.tsx` — fit/reset/minimap/help controls.
- `src/components/workbench/inspector-host.tsx` — selected-board/entity inspector surface.
- `src/components/workbench/mobile-workbench.tsx` — non-infinite-canvas mobile presentation.
- `src/components/workbench/secondary-route-frame.tsx` — compact frame for existing non-workbench pages.

### Existing files modified in Phase A/B

- `package.json` — spatial dependencies and verification scripts.
- `src/app/globals.css` — workbench tokens, board surfaces, canvas chrome, reduced motion.
- `src/app/app/layout.tsx` — replace persistent 248 px sidebar with spatial shell routing frame.
- `src/app/app/page.tsx` — server loader → `WorkbenchSnapshot` → `WorkbenchShell`.
- `src/components/tracelab/today-model.ts` — nested-row date/provider regression compatibility until adapter fully owns it.
- `tests/frontend-contract.node.test.ts` — route/design contracts for the spatial slice.
- `tests/workbench-model.node.test.ts` — pure adapter/layout regression tests.
- `scripts/frontend-static-audit.mjs` — spatial accessibility/motion anti-regression rules.

### Later phases

- `src/app/app/graph/graph-view.tsx` → fine-grained React Flow Trace.
- `src/app/app/timeline/page.tsx` + new timeline client surface.
- `src/app/app/capture/*` → floating capture integration.

---

### Task 1: Dependency and verification foundation

**Files:**
- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `tests/frontend-contract.node.test.ts`
- Modify: `scripts/frontend-static-audit.mjs`

**Interfaces:**
- Consumes: existing Next/React/Tailwind application.
- Produces: package declarations for React Flow/Motion/Zustand/resizable panels and stable workbench CSS tokens used by every later task.

- [x] **Step 1: Add a failing contract for workbench package/style requirements**

Append a Node contract asserting `package.json` contains `@xyflow/react`, `motion`, `zustand`, and `react-resizable-panels`, and `src/app/globals.css` contains `--workbench-bg`, `--workboard-bg`, and `.workbench-surface`.

```ts
test("spatial foundation declares canvas dependencies and tokens", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies["@xyflow/react"], "12.11.6");
  assert.equal(pkg.dependencies.motion, "12.35.0");
  assert.ok(pkg.dependencies.zustand);
  assert.ok(pkg.dependencies["react-resizable-panels"]);
  const css = read("src/app/globals.css");
  for (const token of ["--workbench-bg", "--workboard-bg", ".workbench-surface"]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
});
```

- [x] **Step 2: Run the contract and confirm RED**

Run: `npm run frontend:contract`
Expected: FAIL because spatial dependencies/tokens are absent.

- [x] **Step 3: Add exact dependencies and global tokens**

Add:

```json
"@xyflow/react": "12.11.6",
"motion": "12.35.0",
"react-resizable-panels": "4.7.0",
"zustand": "^4.5.7"
```

Add CSS variables:

```css
--workbench-bg: #202124;
--workbench-bg-deep: #191a1c;
--workbench-dot: rgb(255 255 255 / 0.10);
--workbench-dot-quiet: rgb(255 255 255 / 0.065);
--workbench-selection: #6f8bff;
--workboard-bg: #fbfbf8;
--workboard-bg-raised: #ffffff;
--workboard-border: rgb(17 19 21 / 0.14);
--workboard-shadow: 0 8px 28px rgb(0 0 0 / 0.18);
```

Import `@xyflow/react/dist/style.css` from the spatial client entry rather than globally to keep coupling local.

- [x] **Step 4: Extend static audit**

Reject workbench CSS containing `backdrop-filter`, decorative gradients, perpetual `animation-iteration-count: infinite`, or workboard hover `translateY`/scale effects.

- [x] **Step 5: Run dependency-free verification**

Run: `npm run frontend:verify`
Expected: PASS. Full install/typecheck/build remains an environment gate when npm registry is unavailable.

---

### Task 2: Serializable WorkbenchSnapshot adapter

**Files:**
- Create: `src/components/workbench/types.ts`
- Create: `src/components/workbench/snapshot.ts`
- Create: `tests/workbench-model.node.test.ts`
- Modify: `src/components/tracelab/today-model.ts`

**Interfaces:**
- Consumes: `thisWeek()` rows, active season/project, team context, active policy.
- Produces: `buildWorkbenchSnapshot(input): WorkbenchSnapshot`, with all dates normalized to ISO strings.

- [x] **Step 1: Write regression tests for real nested query rows**

Use the real `thisWeek()` shape:

```ts
const week = {
  needsContext: [{ ev: { id: "e1", provider: "github", eventType: "commit", title: "Tune intake", occurredAt: new Date("2026-09-04T10:00:00Z"), status: "inbox", summary: null }, actor: "Anim", subsystem: "Intake" }],
  recent: [{ ev: { id: "e1", provider: "github", eventType: "commit", title: "Tune intake", occurredAt: new Date("2026-09-04T10:00:00Z") }, actor: "Anim" }],
  activeIterations: [], tests: 0, decisions: 0, inboxCount: 1, totalEvents: 1,
};
```

Assert:

```ts
assert.equal(snapshot.needsContext[0].occurredAt, "2026-09-04T10:00:00.000Z");
assert.equal(snapshot.needsContext[0].provider, "github");
assert.equal(snapshot.counts.needsContext, 1);
assert.equal(snapshot.team.name, "Orion Robotics");
```

Also assert malformed/absent optional dates never trigger `.getTime()` on `undefined`.

- [x] **Step 2: Run model test and confirm RED**

Run: `node --experimental-strip-types --test tests/workbench-model.node.test.ts`
Expected: FAIL because adapter/types do not exist.

- [x] **Step 3: Implement serializable presentation types**

Define `WorkbenchSnapshot`, `NeedsContextItem`, `RecentEvidenceItem`, `ActiveIterationItem`, `TestSummary`, `DecisionSummary`, `PolicySummary` exactly as client-safe primitives.

- [x] **Step 4: Implement adapter helpers**

Use one helper:

```ts
export function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
```

Never pass raw Drizzle rows into workboard components.

- [x] **Step 5: Preserve compatibility in `today-model.ts`**

Until old Today code is deleted, let `prioritizeNeedsContext()` accept both flat event objects and `{ ev }` rows, preventing the previously observed nested-row `occurredAt.getTime()` crash.

- [x] **Step 6: Run RED→GREEN verification**

Run:

```bash
node --experimental-strip-types --test tests/workbench-model.node.test.ts
npm run frontend:verify
```

Expected: all PASS.

---

### Task 3: Deterministic coarse-board layout model

**Files:**
- Create: `src/components/workbench/layout.ts`
- Modify: `tests/workbench-model.node.test.ts`

**Interfaces:**
- Consumes: `WorkbenchSnapshot` counts/content presence.
- Produces: `buildWorkbenchNodes(snapshot): WorkbenchNodeModel[]`, `buildWorkbenchEdges(snapshot): WorkbenchEdgeModel[]`, `getWorkbenchExtent(nodes)`.

- [x] **Step 1: Write failing layout tests**

Assert six stable semantic board IDs/kinds, intentionally asymmetric dimensions/positions, no overlaps in the default layout, and finite padded extent.

Expected IDs:

```ts
[
  "needs-context",
  "active-iteration",
  "recent-evidence",
  "test-bench",
  "decision-trail",
  "process-health",
]
```

- [x] **Step 2: Run model test and confirm RED**

Run: `node --experimental-strip-types --test tests/workbench-model.node.test.ts`

- [x] **Step 3: Implement deterministic layout v1**

Use design coordinates around a centered origin, for example:

```ts
const DEFAULT_BOARD_LAYOUT = {
  "needs-context": { x: 0, y: 40, width: 380, height: 420 },
  "active-iteration": { x: 500, y: 0, width: 480, height: 510 },
  "recent-evidence": { x: 1010, y: 60, width: 420, height: 330 },
  "test-bench": { x: 410, y: 610, width: 380, height: 350 },
  "decision-trail": { x: 850, y: 600, width: 360, height: 290 },
  "process-health": { x: 1270, y: 520, width: 320, height: 250 },
} as const;
```

Generate only real semantic trace edges; do not invent evidence-domain relationships.

- [x] **Step 4: Implement bounded extent calculation**

Return `[[minX - pad, minY - pad], [maxX + pad, maxY + pad]]` with padding derived from approximate viewport breathing room.

- [x] **Step 5: Run tests**

Expected: model suite PASS.

---

### Task 4: Spatial shell and route framing

**Files:**
- Create: `src/components/workbench/tool-rail.tsx`
- Create: `src/components/workbench/workbench-top-bar.tsx`
- Create: `src/components/workbench/secondary-route-frame.tsx`
- Modify: `src/app/app/layout.tsx`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Consumes: existing server `TeamContext`, navigation model, policy, teams, locale.
- Produces: full-viewport primary workbench shell while preserving navigability of secondary routes.

- [x] **Step 1: Write failing shell contract**

Assert old `w-[248px]` persistent sidebar is absent and the layout references `ToolRail` plus a spatial route frame. Assert `/app` remains the primary workbench route and Capture/Timeline/Trace/Search/Outputs/Settings are available from compact navigation.

- [x] **Step 2: Confirm RED**

Run: `npm run frontend:contract`.

- [x] **Step 3: Build ToolRail**

Use existing `TraceMark`/`TraceIcon`; 52–56 px desktop rail; icon + accessible label/tooltips; no 20-item first-level navigation.

- [x] **Step 4: Recompose Server `AppLayout`**

Keep authorization/team/policy queries in the layout. Remove conventional centered max-width wrapper for the primary workbench. Secondary routes render through `SecondaryRouteFrame` rather than forcing the spatial canvas into a list page shell.

- [x] **Step 5: Preserve mobile navigation until Task 8**

Do not break the existing mobile route escape hatch while desktop canvas is introduced.

- [x] **Step 6: Run contracts/audit/syntax**

Run: `npm run frontend:verify`.

---

### Task 5: Transient workbench store and viewport/focus state

**Files:**
- Create: `src/components/workbench/store.ts`
- Modify: `tests/workbench-model.node.test.ts`

**Interfaces:**
- Produces: `useWorkbenchStore` state/actions for selection, focus, inspector, minimap, interaction mode, previous viewport.

- [x] **Step 1: Add reducer-level/state-contract tests**

Factor pure transition helpers so dependency-free Node tests can verify:

```ts
select("test-bench") -> selectedId="test-bench", inspectorOpen=true
focus("test-bench", viewport) -> focusedId + saved lastViewport
escape() while focused -> clears focus and returns saved viewport intent
escape() while only selected -> closes inspector / clears selection
```

- [x] **Step 2: Confirm RED**

Run model suite.

- [x] **Step 3: Implement narrow Zustand store**

Do not store `WorkbenchSnapshot` itself. Persist only coarse board positions in `localStorage` under `tracelab:workbench:<team>:<season>:v1`.

- [x] **Step 4: Implement reset-layout action**

Remove only the current team/season layout key; never clear unrelated localStorage.

- [x] **Step 5: Verify model suite**

Expected: PASS.

---

### Task 6: React Flow canvas foundation

**Files:**
- Create: `src/components/workbench/workboard-node.tsx`
- Create: `src/components/workbench/workboard-content.tsx`
- Create: `src/components/workbench/spatial-canvas.tsx`
- Create: `src/components/workbench/canvas-controls.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Consumes: normalized snapshot + deterministic node/edge models + transient store.
- Produces: full-viewport, bounded, design-tool-style React Flow canvas.

- [x] **Step 1: Write failing canvas contract**

Assert `SpatialCanvas` imports `ReactFlow`, `Background`, `MiniMap`, `useReactFlow`; uses `selectionOnDrag`, `panOnScroll`, `zoomOnDoubleClick={false}`, and explicit min/max zoom; custom node type is defined outside render.

- [x] **Step 2: Confirm RED**

Run contract suite.

- [x] **Step 3: Implement custom workboard base node**

Board node has:
- visible semantic kind label,
- selection/focus ring,
- drag region,
- keyboard-focusable content,
- fixed semantic dimensions from layout model,
- no decorative Handles unless an actual coarse trace edge needs anchors.

- [x] **Step 4: Implement Figma-style React Flow config**

Use the reference behavior:

```tsx
<ReactFlow
  selectionOnDrag
  panOnScroll
  panOnDrag={[1, 2]}
  zoomOnDoubleClick={false}
  minZoom={0.35}
  maxZoom={1.65}
  onlyRenderVisibleElements
  nodesDraggable
  elementsSelectable
/>
```

Support `Space` temporary pan using store interaction mode rather than mutating domain nodes.

- [x] **Step 5: Add quiet dotted `Background` and bounded extent**

Use React Flow Background with low-contrast dots. No CSS starfield.

- [x] **Step 6: Add CanvasControls**

Buttons: Fit, 100%, minimap toggle, reset layout, keyboard help. Every icon-only button gets an accessible name.

- [x] **Step 7: Verify**

Run `npm run frontend:verify` and, when dependencies are available, `npm run typecheck`.

---

### Task 7: Workboard content and real `/app` server→client slice

**Files:**
- Create: `src/components/workbench/workbench-shell.tsx`
- Create: `src/components/workbench/inspector-host.tsx`
- Modify: `src/components/workbench/workboard-content.tsx`
- Modify: `src/app/app/page.tsx`
- Modify: `tests/frontend-contract.node.test.ts`
- Modify: `tests/workbench-model.node.test.ts`

**Interfaces:**
- Server page consumes `requireTeam()`, `thisWeek()`, `getActiveSeasonAndProject()`, `loadTeamPolicy()`.
- Server page produces one `WorkbenchSnapshot`.
- Client workbench consumes only that snapshot plus safe URLs/labels.

- [x] **Step 1: Add failing route contract**

Assert `src/app/app/page.tsx` builds a snapshot and renders `<WorkbenchShell snapshot={snapshot} />`, with no old `Today` dashboard header/summary cards.

- [x] **Step 2: Confirm RED**

Run contract suite.

- [x] **Step 3: Implement six board contents**

`Needs Context` prioritizes the first real missing-human-rationale item and links to `/app/context/:id`.

`Active Iteration` shows current iteration state/subsystem and a compact evidence/test/decision trail.

`Recent Evidence` shows latest source events with provenance/source identity.

`Test Bench` shows recent test count/results and links to `/app/tests`.

`Decision Trail` shows recent decision count/outcomes and links to `/app/decisions`.

`Process Health` shows policy/sync/inbox guardrails, never a productivity KPI dashboard.

- [x] **Step 4: Implement InspectorHost**

Selection opens a 360–420 px dock. Inspector shows details for the selected coarse board and deep links to the relevant existing route. It does not duplicate or mutate server-domain state.

- [x] **Step 5: Implement focus behavior**

Double click or Enter stores current viewport and calls `fitView({ nodes: [{ id }], padding, duration })`. Esc restores previous viewport where possible and clears focused state.

- [x] **Step 6: Replace `/app` page**

Delete conventional Today list composition from the primary page. Preserve welcome/policy information inside snapshot/workboards/top bar.

- [x] **Step 7: Verify dependency-free suite**

Run:

```bash
npm run frontend:verify
node --experimental-strip-types --test tests/workbench-model.node.test.ts
```

- [ ] **Step 8: Full runtime gate when npm registry is available**

Run:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Then launch `npm run dev` against seeded PostgreSQL and manually open `/app`.

---

### Task 8: Mobile spatial adaptation

**Files:**
- Create: `src/components/workbench/mobile-workbench.tsx`
- Modify: `src/components/workbench/workbench-shell.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Consumes: same `WorkbenchSnapshot`.
- Produces: focused/snap mobile board navigation with bottom inspector/capture, not a miniature infinite canvas.

- [x] **Step 1: Add failing mobile contract**

Assert a mobile workbench exists and that React Flow canvas is hidden below the chosen breakpoint while semantic board content remains available.

- [x] **Step 2: Confirm RED**

Run contract suite.

- [x] **Step 3: Implement horizontal snap/focused board navigator**

Use semantic buttons and CSS scroll snap. Preserve direct links to detail routes.

- [x] **Step 4: Implement mobile inspector/capture as bottom surface**

Avoid adding a second permanent navigation bar competing with the capture action.

- [x] **Step 5: Verify audit/contracts**

Run `npm run frontend:verify`.

---


---

## Follow-on plans after this checkpoint

This implementation plan intentionally stops after the first independently testable subsystem: the Spatial Home Workbench (foundation, snapshot adapter, coarse-board layout, shell, transient canvas state, React Flow home canvas, inspector/focus, and mobile adaptation). The design spec also defines Evidence Trace, Timeline, Capture spatial polish, and final performance/browser QA. Those are separate implementation plans because each has its own data/interaction surface and can be reviewed independently.

**Checkpoint acceptance:** `/app` renders the six-board spatial workbench from a serializable server snapshot; the old 248 px dashboard shell is gone on the primary route; desktop pan/zoom/select/focus/inspector behavior is wired; mobile receives a focused-board presentation; secondary routes remain reachable; dependency-free verification is green. Full production verification still requires installed npm dependencies and the existing PostgreSQL seed.
