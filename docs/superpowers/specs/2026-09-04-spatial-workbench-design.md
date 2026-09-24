# TraceLab Spatial Evidence Workbench — Design Specification

**Date:** 2026-09-04  
**Status:** Design approved in conversation; written specification pending user review  
**Scope:** Replace the primary authenticated presentation model with a spatial evidence workbench while preserving TraceLab's evidence, provenance, policy, offline, and team-domain behavior.  
**Primary route:** `/app`  
**Reference direction:** Google Stitch spatial artboards + n8n/Activepieces flow-builder interaction discipline + TraceLab evidence semantics.

---

## 1. Executive decision

TraceLab will stop treating `/app` as a conventional dashboard page composed of vertically stacked sections. `/app` becomes a full-viewport **Spatial Evidence Workbench** where the engineering project is represented as a small number of meaningful workboards arranged on a dark, pannable/zoomable canvas.

The workbench is not a diagram editor and not a generic workflow builder. Students do not manually draw arbitrary edges or design workflows. The graph is a presentation of **real engineering relationships already present in TraceLab**:

`source event → student rationale → iteration → test → decision → next iteration`

The interface must make three things immediately legible:

1. **What needs human context now.**
2. **What engineering change is currently in motion.**
3. **What evidence caused a test or decision.**

The visual model is:

`Canvas → Workboard → Focus/Inspector`

rather than:

`Sidebar → Page → Section → List → Detail page`.

---

## 2. Why this redesign is necessary

The current frontend already has strong product semantics, but its main presentation model is still a conventional web application:

- `src/app/app/layout.tsx` renders a fixed 248 px sidebar.
- `<main>` is constrained to `max-w-[1320px]`.
- `/app` renders `Needs your context`, `Recent evidence`, `Open iterations`, and `Process context` as ordinary page sections.
- `/app/timeline` is a long grouped HTML list.
- `/app/graph/graph-view.tsx` is a hand-built fixed SVG with four columns.
- most secondary routes are navigated through first-level sidebar links.

This creates a mismatch with TraceLab's product thesis. Engineering history is relational and spatially meaningful, but the UI currently reads like a database-backed SaaS dashboard.

The supplied visual reference demonstrates the opposite model: a dark world-space canvas with multiple bright work surfaces positioned in a memorable spatial composition. That is a better fit for TraceLab because evidence, tests, decisions, rationale, and iteration are separate artifacts that should be understood together rather than as unrelated menu destinations.

---

## 3. Product invariants that must survive the redesign

The spatial redesign must not change the product into a workflow authoring tool.

These invariants are non-negotiable:

- TraceLab remains **engineering evidence infrastructure**, not a notebook or diagram editor.
- Source provenance stays visible and immutable.
- Student-authored rationale stays distinguishable from source metadata and AI output.
- AI never invents causal relationships.
- Accepted and suggested relationships remain visually distinct.
- Competition policy remains a first-class constraint.
- Team and organization authorization stays server-enforced.
- Student/coach authorship rules stay server-enforced.
- Existing offline capture/outbox behavior remains authoritative for capture.
- EXIF/GPS stripping behavior remains unchanged.
- Existing detail routes remain available for deep links and accessibility.
- Mobile remains optimized for capture and focused review, not tiny infinite-canvas manipulation.
- Counts are context, not productivity scoring.
- No public leaderboard, confetti, giant AI CTA, glassmorphism, generic bento dashboard, or decorative graph clutter.

---

## 4. Reference repository findings

The supplied repositories were inspected locally. They are references for interaction architecture and implementation mechanics, not visual templates to copy verbatim.

### 4.1 XYFlow / React Flow

**Repository:** `xyflow-main`  
**License:** MIT  
**Inspected package version:** `@xyflow/react 12.11.6`

Relevant source/reference paths:

- `examples/react/src/examples/Figma/index.tsx`
- `packages/react/src/types/component-props.ts`
- `packages/react/src/container/ReactFlow/`
- `packages/react/src/additional-components/Background/`
- `packages/react/src/additional-components/Controls/`
- `packages/react/src/additional-components/MiniMap/`

Key findings:

- The included Figma example uses `selectionOnDrag`, `SelectionMode.Partial`, `panOnDrag={[1, 2]}`, `panOnScroll`, a modifier for zoom activation, and multi-select modifiers.
- React Flow exposes the exact primitives needed for TraceLab: controlled nodes/edges, viewport control, custom nodes/edges, `fitView`, `MiniMap`, `Background`, keyboard interaction, selection, `onlyRenderVisibleElements`, and programmatic focus.
- React Flow should own viewport mathematics and node hit-testing; TraceLab should own domain meaning and presentation.

**Decision:** React Flow becomes the workbench viewport engine and replaces the current hand-built SVG graph for spatial surfaces.

### 4.2 Activepieces

**Repository:** `activepieces-main`  
**License:** MIT for the inspected non-EE builder paths; enterprise directories have separate licensing and will not be copied.  
**Inspected builder dependency:** `@xyflow/react 12.3.5`

Relevant paths:

- `.agents/skills/design/README.md`
- `.agents/skills/design/SKILL.md`
- `packages/web/src/app/builder/flow-canvas/index.tsx`
- `packages/web/src/app/builder/state/canvas-state.ts`
- `packages/web/src/app/builder/flow-canvas/canvas-controls/index.tsx`
- `packages/web/src/app/builder/flow-canvas/widgets/minimap.tsx`
- `packages/web/src/app/builder/step-data/step-data-panel-host.tsx`

Key findings:

- Canvas state is deliberately separated from domain flow state.
- Selected nodes, panning mode, minimap visibility, orientation, and right sidebar are independent state concerns.
- Canvas uses a bounded `translateExtent` calculated around real content, preventing the user from becoming lost in meaningless infinite empty space.
- The minimap is conditional, pannable, and zoomable rather than always occupying screen space.
- Zoom controls use immediate response; the builder does not animate every small zoom button press.
- The detail/data panel exists outside the canvas interaction layer and supports drawer/split modes.
- The dotted background is restrained and tool-like.

**Decision:** TraceLab adopts the separation of `domain data`, `canvas presentation state`, and `inspector state`, but not Activepieces' workflow-node visual identity.

### 4.3 Excalidraw

**Repository:** `excalidraw-master`  
**License:** MIT

Relevant paths:

- `packages/excalidraw/components/App.tsx`
- `packages/excalidraw/types.ts`
- `packages/excalidraw/tests/interactivity.test.tsx`
- `packages/excalidraw/tests/scrollConstraints.test.tsx`

Key findings:

- Spacebar-held primary drag and middle-mouse drag are stable, learnable canvas gestures.
- Wheel/trackpad navigation and modifier-based zoom should feel direct and interruptible.
- Canvas input must coexist safely with browser/page behavior.
- Interaction behavior deserves dedicated regression tests because small input changes can destroy spatial usability.

**Decision:** TraceLab uses a design-tool interaction model rather than the default “wheel always zooms” graph-viewer model.

### 4.4 Langflow

**Repository:** `langflow-main`  
**License:** MIT  
**Inspected builder dependency:** `@xyflow/react ^12.3.6`

Relevant paths:

- `src/frontend/src/stores/flowStore.ts`
- `src/frontend/src/components/core/canvasControlsComponent/`
- `src/frontend/src/contexts/index.tsx`
- `src/frontend/src/pages/FlowPage/components/PageComponent/index.tsx`

Key findings:

- React Flow instance state is stored separately from domain data.
- `fitView` timing is treated carefully; tests explicitly account for nodes not being measured yet.
- Canvas controls and inspection-panel behavior have accessibility-focused tests.
- Large visual builders benefit from explicit “fit request” state rather than ad-hoc `setTimeout` calls.

**Decision:** TraceLab must wait for node measurement before initial fit/focus and must test the inspector/control layer separately from evidence semantics.

---

## 5. Chosen architecture

### 5.1 Architecture option selected

**Selected:** Spatial Workbench + React Flow custom workboards.

Rejected alternatives:

1. **Canvas skin over current page layout** — rejected because it preserves the dashboard mental model under decorative dots.
2. **Full n8n-style graph editor** — rejected because TraceLab users should record engineering evidence, not manually author arbitrary workflow topology.

### 5.2 High-level composition

```text
AppLayout (Server Component)
├── authorization / team / policy / locale
├── WorkbenchShell (Client boundary)
│   ├── ToolRail
│   ├── WorkbenchTopBar
│   ├── SpatialCanvas
│   │   └── ReactFlowProvider / ReactFlow
│   │       ├── Workboard nodes
│   │       ├── Trace edges
│   │       ├── Background
│   │       ├── CanvasControls
│   │       └── MiniMap (optional)
│   ├── InspectorHost
│   ├── CaptureLauncher
│   ├── CommandPalette
│   └── Live region / keyboard help
└── SecondaryRouteFrame for non-workbench routes
```

The authenticated layout remains a Server Component because team access, role, locale, policy, and notification state must be established on the server. Only the interactive workbench becomes a client boundary.

### 5.3 Server/client boundary

**Server remains responsible for:**

- `requireTeam()` and all authorization.
- active team / season / project.
- `thisWeek()` summary source.
- `evidenceGraph()` domain graph.
- policy state.
- source-event context and provenance.
- capture actions and mutation authorization.
- tests/decisions/iterations data.

**Client owns only presentation state:**

- viewport `{x, y, zoom}`.
- selected workboard/entity.
- focused workboard/entity.
- inspector open/closed/width.
- minimap visibility.
- panning/select mode.
- temporarily dragged workboard positions.
- current canvas mode (`workbench`, later `trace`).

No client state is allowed to become the source of truth for evidence relations, authorship, or policy.

---

## 6. Route strategy

Existing routes are preserved to avoid breaking deep links, server actions, and accessible alternatives.

### 6.1 Primary routes

- `/app` → Spatial Workbench.
- `/app/timeline` → dedicated timeline power-view; later shares the same inspector and selection model.
- `/app/graph` → dedicated fine-grained Evidence Trace powered by React Flow.
- `/app/capture` → full capture route remains available; the workbench launcher can open a compact capture surface or route here.

### 6.2 Detail routes preserved

- `/app/context/[id]`
- `/app/iterations/[id]`
- `/app/tests/[id]`
- `/app/decisions/[id]`

They remain canonical deep-link destinations.

### 6.3 Secondary/admin routes preserved

Inbox, Search, Memory, Exports, Competition, Integrations, Members, Coach, Organization, Notifications, Settings, Handoff, and Failures remain normal routes. They are removed from the permanent first-level sidebar and surfaced through ToolRail shortcuts, Command Palette, contextual links, or a compact workspace menu.

---

## 7. Shell redesign

### 7.1 Desktop shell

The old 248 px sidebar is removed from the primary workbench.

Target geometry at desktop widths:

- ToolRail: `52–56 px` fixed left.
- TopBar: `44–48 px` floating inside canvas world UI, not a full-width app chrome band.
- Canvas: remaining viewport, `100dvh` minus no conventional page padding.
- Inspector: `360–420 px`, resizable to a safe range of roughly `320–520 px`.
- Canvas Controls: floating lower-left, outside world transform.
- MiniMap: optional lower-right; hidden by default on smaller laptops.

### 7.2 ToolRail information architecture

Permanent controls are intentionally few:

- Workbench
- Capture
- Search/Command
- Timeline
- Trace
- Outputs / Competition entry
- Settings / workspace menu

Tests, Decisions, Inbox, Memory, Handoff, Members, Coach, and Organization remain discoverable but are not all permanent first-level rail icons.

### 7.3 SecondaryRouteFrame

Normal routes still need stable navigation. When the user leaves `/app`, the shell may expose a compact expanded navigation sheet or 200–220 px route sidebar. This secondary frame must not force the workbench back into a traditional dashboard layout.

---

## 8. Spatial visual system

### 8.1 Canvas

The default workbench canvas is intentionally graphite even when the rest of TraceLab is in its light theme.

Proposed tokens:

```css
--workbench-bg: #202124;
--workbench-bg-deep: #191a1c;
--workbench-dot: rgb(255 255 255 / 0.10);
--workbench-dot-quiet: rgb(255 255 255 / 0.065);
--workbench-grid-gap: 20px;
--workbench-selection: #6f8bff;
```

The canvas must feel like an engineering desktop, not a starfield. No gradients, glows, floating particles, or decorative blobs.

### 8.2 Workboards

Workboards are light physical surfaces on the dark canvas:

```css
--workboard-bg: #fbfbf8;
--workboard-bg-raised: #ffffff;
--workboard-border: rgb(17 19 21 / 0.14);
--workboard-shadow: 0 8px 28px rgb(0 0 0 / 0.18);
```

They use TraceLab's semantic accent colors only as small structural signals:

- Source / context → Trace Blue.
- Iteration → Signal Lime.
- Test → Test Orange.
- Decision → Decision Violet.
- Verified → Verified Green.
- Failure → Failure Red.

No board is filled edge-to-edge with a semantic color.

### 8.3 Board geometry

Boards intentionally vary in size and hierarchy. They must not fall into a `grid-cols-N` dashboard rhythm.

Initial target dimensions:

- Needs Context: roughly `380 × 420`.
- Active Iteration: roughly `460–500 × 480–540`.
- Recent Evidence / Media: roughly `400–440 × 300–360`.
- Test Bench: roughly `360–400 × 320–380`.
- Decision Trail: roughly `340–380 × 260–320`.
- Process Health / Policy: compact utility board, roughly `300–340 × 220–280`.

Dimensions are design constraints, not exact hard-coded pixels for every viewport.

### 8.4 Shape language

- Workboards: 14–18 px radius.
- Floating UI / inspector: 12–16 px radius.
- Utility buttons: 8–10 px radius.
- Chips: pill only when semantically appropriate.
- No giant 28–32 px generic SaaS rounding on every surface.

### 8.5 Typography

Keep the established TraceLab direction:

- Instrument Sans for UI and board titles.
- IBM Plex Mono for provenance, hashes, timestamps, IDs, relation labels, and technical metadata.
- Board body default around 13–14 px.
- Canvas labels and metadata 10–12 px.
- Board titles 15–20 px depending hierarchy.

The spatial interface must become denser than the existing marketing-like page headings. A 36 px “Today” title no longer belongs inside the workbench.

---

## 9. Workbench domain model

The main workbench deliberately shows **coarse semantic workboards**, not one node per database row.

### 9.1 Initial workboard types

```ts
type WorkboardKind =
  | "needs-context"
  | "active-iteration"
  | "recent-evidence"
  | "test-bench"
  | "decision-trail"
  | "process-health";
```

Each workboard summarizes a bounded set of real entities and exposes entry points to inspect individual evidence.

### 9.2 Why coarse boards

Fine-grained evidence graphs become unreadable quickly. The home workbench should answer “what is happening in the project?” rather than display hundreds of nodes.

The dedicated `/app/graph` route is where individual source events, iterations, tests, and decisions become fine-grained React Flow nodes.

### 9.3 Workbench data contract

Proposed serializable shape passed from the server page to the client workbench:

```ts
export interface WorkbenchSnapshot {
  team: {
    id: string;
    name: string;
    number: string | null;
    program: string;
    timezone: string;
  };
  project: {
    id: string | null;
    seasonId: string | null;
    title: string | null;
  };
  policy: {
    status: "clear" | "needs_review" | "restricted";
  };
  needsContext: NeedsContextItem[];
  recentEvidence: RecentEvidenceItem[];
  activeIterations: ActiveIterationItem[];
  recentTests: TestSummary[];
  recentDecisions: DecisionSummary[];
  counts: {
    inbox: number;
    tests: number;
    decisions: number;
    needsContext: number;
  };
}
```

Date objects must be normalized to ISO strings before crossing the client boundary. This avoids the class of runtime bug already encountered where components assumed a `Date` instance but received a different shape.

---

## 10. Canvas state model

Canvas state is independent from evidence data.

```ts
export interface WorkbenchCanvasState {
  selectedId: string | null;
  focusedId: string | null;
  inspectorOpen: boolean;
  inspectorWidth: number;
  minimapOpen: boolean;
  interactionMode: "select" | "hand";
  lastViewport: { x: number; y: number; zoom: number } | null;
}
```

### 10.1 State technology

Use a small Zustand store for high-frequency transient canvas state. React server data does not enter the Zustand store as an authoritative copy.

Reasons:

- React Flow already uses Zustand internally; the pattern is well-proven in both Activepieces and Langflow.
- selection, inspector state, keyboard modes, and viewport events change too frequently to thread through the entire component tree.
- it allows narrow selectors that avoid repainting every workboard when the inspector opens.

### 10.2 Position persistence

Initial implementation:

- deterministic default positions from a TraceLab layout function;
- optional user-adjusted coarse workboard positions saved in `localStorage` keyed by `teamId + seasonId + layoutVersion`;
- `Reset layout` returns to deterministic defaults.

Do not add a database table in the first spatial slice. Cross-device layout sync is not evidence-domain behavior and can be added after the interaction model is validated.

---

## 11. Interaction model

### 11.1 Pointer / trackpad

Default desktop interaction follows design-tool conventions:

- Primary click on workboard → select.
- Primary drag on workboard header/drag region → move workboard if board movement is enabled.
- Primary drag on empty canvas → selection rectangle in Select mode.
- Middle-mouse drag → pan.
- Right-button drag may pan where browser/context-menu behavior is safely suppressed.
- Space + primary drag → pan.
- Trackpad/wheel → pan canvas.
- Pinch → zoom.
- Ctrl/Cmd + wheel → zoom where supported by React Flow configuration.
- Double click empty canvas → no zoom; avoid accidental disorientation.
- Double click workboard or Enter → focus board.
- Esc from focus → restore previous viewport and close deep inspector state.

React Flow configuration is based on its included Figma example rather than default graph-editor behavior.

### 11.2 Keyboard

Required shortcuts:

- `Space` hold → temporary hand/pan mode.
- `F` → fit project/workboards.
- `1` → 100% zoom.
- `0` → fit view.
- `Cmd/Ctrl + K` → command palette.
- `Enter` on selected board → focus/inspect.
- `Esc` → back out one spatial layer.
- Arrow keys → move focus among workboards using nearest-neighbor logic when canvas focus is active.
- `?` → keyboard help overlay.

Keyboard shortcuts must not fire while typing in inputs, textareas, selects, or contenteditable surfaces.

### 11.3 Canvas bounds

The canvas should feel infinite without actually allowing meaningless navigation forever.

Compute `translateExtent` from workboard bounds plus approximately one viewport of breathing room on each side, following the useful Activepieces pattern. This keeps minimap scale and “fit project” meaningful.

---

## 12. Selection, focus, and inspector

These are three different states.

### Selection

- highlights a workboard or evidence entity;
- can show compact contextual controls;
- does not move the camera.

### Focus

- stores current viewport;
- moves camera to the selected board/entity with safe padding;
- optionally opens inspector;
- creates the feeling of moving from overview into a work surface.

### Inspector

- lives outside React Flow world transforms;
- desktop: right split panel, resizable;
- narrow desktop/tablet: overlay drawer;
- mobile: bottom sheet/full-screen detail surface.

Inspector tabs are domain-based, not generic:

- Summary
- Provenance
- Relations
- History

Only show tabs that have content.

---

## 13. Workboard specifications

### 13.1 Needs Context board

Primary board when missing human rationale exists.

Must show:

- count of source events waiting for context;
- top 3–5 prioritized events;
- provider icon/label;
- event title;
- subsystem/actor/time;
- direct `Add why` action;
- clear “source preserved / student adds context” message.

It must not show a productivity number or chart.

### 13.2 Active Iteration board

Shows the current engineering change as the center of gravity.

Must show:

- iteration title;
- state;
- subsystem;
- opened date;
- compact linked evidence count;
- latest test outcome if available;
- latest decision status if available;
- path to iteration detail.

If several iterations are open, the board may include a small internal stack/list, but the canvas should still have one “Active Iterations” workboard rather than five separate arbitrary boards by default.

### 13.3 Recent Evidence board

A compact spatial replacement for the current seven-row recent list.

Use a mixed evidence strip/grid inside the board:

- photo thumbnail where available;
- source/provider mark;
- 2–4 newest evidence entries;
- no giant table.

### 13.4 Test Bench board

Shows engineering evaluation rather than “test count”.

Must prioritize:

- newest or currently relevant test;
- result/measurement;
- pass/fail/neutral textual label;
- linked iteration;
- linked decision when one exists.

### 13.5 Decision Trail board

Shows the latest consequential choice and its evidence chain.

Must include:

- decision title;
- disposition;
- date/author;
- linked test/evidence count;
- direct “Why?”/trace entry.

### 13.6 Process / Policy board

Compact utility board only. It can surface:

- policy review required;
- sync/outbox state;
- unlinked inbox count;
- other process conditions.

It must not become a KPI dashboard.

---

## 14. Trace edges on the home workbench

The home workbench uses only a few **semantic macro-edges** between workboards.

Example:

```text
Needs Context ──────▶ Active Iteration
                         │
                         ├────▶ Test Bench
                         │          │
                         │          ▼
                         └────▶ Decision Trail
```

These edges summarize real relationships and are not individually editable.

Edge rules:

- default stroke: subtle neutral/Trace Blue mix;
- accepted causal relationship: solid;
- suggested relationship: dashed + explicit “suggested” semantics in inspector/list alternative;
- no permanently animated marching dashes;
- selected path may increase contrast, not pulse forever;
- arrows/labels remain sparse.

---

## 15. Dedicated Evidence Trace redesign

`/app/graph` becomes a fine-grained React Flow surface.

### 15.1 Node types

- SourceEventNode
- IterationNode
- TestNode
- DecisionNode

Artifacts may be introduced later only if they materially improve trace readability.

### 15.2 Layout

Use ELK.js for deterministic layered layout:

- preferred direction left → right for causal trace;
- source events before iterations;
- tests and decisions positioned according to actual relations;
- suggested edges do not determine authoritative topology when doing so would distort accepted evidence chains.

### 15.3 Existing accessible alternative preserved

The current graph already includes a mobile/list representation and relations table. Preserve and improve this idea. The React Flow graph must have a semantic relation-list alternative that remains usable with keyboard and screen reader.

---

## 16. Timeline redesign

The timeline remains a distinct route because time is a different analytical dimension than causal trace.

Desktop target:

- horizontal time axis or large time-surface;
- grouped lanes for source/iteration/test/decision where density permits;
- subsystem filter remains;
- selected event opens the same InspectorHost used by Workbench/Trace;
- zoom scale changes visible time density, not decorative card size.

Mobile target:

- retain a chronological vertical representation because it is easier to scan and accessible;
- share visual tokens and inspector behavior with desktop.

The existing `subsystemTimeline()` server query remains authoritative.

---

## 17. Capture integration

The existing `/app/capture` route and offline behavior remain intact.

The workbench adds a floating CaptureLauncher:

```text
+ Capture
  ├── Photo
  ├── Test
  ├── Decision
  ├── Iteration
  └── Rationale
```

Desktop behavior:

- launcher opens a compact overlay/drawer for lightweight capture where safe;
- complex capture can route to `/app/capture?...`;
- after successful capture, the workbench refreshes its server snapshot;
- the relevant workboard receives a brief structural highlight or appearance transition.

Mobile behavior:

- Capture remains the primary navigation action;
- use bottom-sheet/full-screen capture rather than a miniature spatial canvas.

No capture mutation is reimplemented purely client-side just to support the workbench.

---

## 18. Motion system

Motion explains spatial/state change. It does not decorate the product.

### 18.1 Timing

- hover/focus color: `100–150 ms`.
- selection state: `120–160 ms`.
- inspector open/close: `200–240 ms`.
- focus camera transition: `240–300 ms`.
- board appearance after new data: `180–240 ms`.
- trace edge reveal when a new relation appears: `240–320 ms`.

### 18.2 Rules

- Canvas pan must be direct with no easing lag.
- Drag must track the pointer exactly.
- Zoom controls should feel immediate; do not add a long spring to repeated zoom button use.
- No card hover lift.
- No repeated floating/bobbing animation.
- No shimmer for ordinary loading.
- No constantly animated edges.
- No 700–1000 ms page transitions.
- Focus transitions must be interruptible by new user input.

### 18.3 Motion library

Use `motion` for inspector/layout/content transitions where CSS is insufficient. React Flow owns viewport and node transforms.

Do not animate React Flow node positions with an independent transform library that fights React Flow's transforms.

### 18.4 Reduced motion

With `prefers-reduced-motion: reduce`:

- camera focus becomes near-instant;
- inspector uses opacity/visibility with minimal movement;
- edge reveal becomes immediate;
- no spring settling.

---

## 19. Mobile strategy

Do **not** ship the desktop infinite canvas simply scaled down.

Below the mobile breakpoint, `/app` becomes **Focused Workboards**:

- compact top project header;
- horizontal/snap board navigator or vertical prioritized boards;
- one dominant board at a time;
- Capture bottom action;
- inspector becomes bottom sheet/full-screen detail;
- direct links to Timeline and Trace remain available.

The same `WorkbenchSnapshot` feeds both desktop spatial and mobile focused views, so product semantics stay consistent.

---

## 20. Performance architecture

### 20.1 Home workbench

Only a small number of coarse workboards exist, so performance should be dominated by contained board content, not graph scale.

Requirements:

- memoize node type map outside render;
- memoize workboard node data by semantic slice;
- do not put the entire server snapshot into every node's `data` prop;
- inspector loads heavy provenance/history data only when necessary;
- avoid rerendering all nodes for cursor movement or inspector resize.

### 20.2 Fine-grained Trace

For `/app/graph`:

- `onlyRenderVisibleElements` enabled after verifying it does not harm expected selection behavior;
- cap initial server query as current `evidenceGraph()` already does for source events;
- use ELK off the critical render path when graph size is large;
- initial `fitView` only after nodes are initialized/measured;
- preserve filters/subsystem scoping.

### 20.3 Expected validation sizes

Test at least:

- 6 coarse workboards / normal home.
- 50 graph entities.
- 100 graph entities.
- 300 graph entities.

The home workbench must remain fast regardless of fine-grained graph size because it does not render every entity as a workboard.

---

## 21. Accessibility

Spatial UI must remain operable without spatial pointing precision.

Required:

- every workboard is keyboard-focusable with a meaningful accessible name;
- selection is not communicated only by color;
- workboard actions have normal DOM buttons/links inside nodes;
- focus-visible remains strong;
- `aria-live` announces selection/focus changes only when useful, not every viewport movement;
- keyboard help is discoverable;
- all icon-only ToolRail/CanvasControl buttons have accessible labels/tooltips;
- Trace route retains relation-list/table alternative;
- mobile uses non-canvas focused boards;
- minimum touch target ≈ 44 px for primary mobile actions;
- reduced-motion support is mandatory;
- zoom/pan are not required to access evidence because normal detail routes remain available.

---

## 22. Error handling and resilience

The workbench must fail gracefully if presentation-layer canvas logic fails.

- Server auth/database errors continue to use existing Next error handling.
- If React Flow client initialization fails, render a recoverable fallback linking to Timeline, Inbox, Tests, and Decisions rather than a blank screen.
- A malformed saved local layout must be ignored and reset to deterministic defaults.
- Unknown/missing `occurredAt` values must be normalized before sorting; never call methods on unchecked optional dates.
- Inspector selection for a deleted/nonexistent entity clears selection and shows a non-destructive toast/state.
- URL/deep-link focus to an entity not present in the current snapshot routes to its canonical detail route when possible.

---

## 23. Dependencies

Planned new runtime dependencies:

```text
@xyflow/react
elkjs
motion
zustand
react-resizable-panels
@phosphor-icons/react
```

Notes:

- `@xyflow/react` is the core viewport engine.
- `elkjs` is used for dedicated fine-grained graph layout, not required for the six home workboards.
- `motion` is limited to explanatory UI transitions.
- `zustand` stores transient canvas/inspector state.
- `react-resizable-panels` provides robust desktop inspector resizing.
- Phosphor provides generic interface icons; TraceLab-specific evidence semantics remain behind `TraceIcon` or dedicated semantic components.

Do not add a second graph/canvas library.

---

## 24. Proposed component/file architecture

New focused files are preferred over another monolithic `graph-view.tsx`.

```text
src/components/workbench/
├── workbench-shell.tsx
├── workbench-canvas.tsx
├── workbench-mobile.tsx
├── workbench-top-bar.tsx
├── tool-rail.tsx
├── canvas-controls.tsx
├── workbench-minimap.tsx
├── capture-launcher.tsx
├── inspector/
│   ├── inspector-host.tsx
│   ├── inspector-summary.tsx
│   ├── inspector-provenance.tsx
│   ├── inspector-relations.tsx
│   └── inspector-history.tsx
├── nodes/
│   ├── workboard-frame.tsx
│   ├── needs-context-board.tsx
│   ├── active-iteration-board.tsx
│   ├── recent-evidence-board.tsx
│   ├── test-bench-board.tsx
│   ├── decision-trail-board.tsx
│   └── process-health-board.tsx
├── edges/
│   └── trace-edge.tsx
├── model/
│   ├── types.ts
│   ├── build-workbench-graph.ts
│   ├── default-layout.ts
│   ├── layout-storage.ts
│   └── navigation.ts
└── state/
    └── workbench-store.ts

src/components/trace-graph/
├── trace-canvas.tsx
├── trace-node.tsx
├── trace-edge.tsx
├── trace-layout.ts
└── trace-accessible-list.tsx
```

Existing `src/components/tracelab/` remains the semantic component layer for badges, evidence styling, source presentation, and shared primitives.

---

## 25. Data adapters

Do not pass raw Drizzle rows directly into canvas nodes.

Introduce server-side or pure adapter functions that create stable serializable view models.

Example:

```ts
export interface NeedsContextItem {
  id: string;
  provider: string;
  eventType: string;
  title: string;
  occurredAt: string;
  actor: string | null;
  subsystem: string | null;
}
```

This boundary prevents accidental coupling to nested query shapes such as `{ ev, actor, subsystem }` and directly addresses the runtime bug previously encountered in `today-model.ts`.

---

## 26. Testing strategy

The spatial redesign requires more than snapshot/string contract tests.

### 26.1 Pure model tests

Test:

- workbench snapshot adapters;
- default workboard positions;
- persisted-layout validation/fallback;
- macro-edge construction;
- nearest-neighbor keyboard navigation;
- URL/focus serialization;
- trace layout input generation.

### 26.2 Component tests

Test:

- workboard semantic labels/actions;
- selected/focused states;
- inspector content and dismissal;
- ToolRail accessible labels;
- canvas-control state;
- fallback behavior.

### 26.3 Interaction tests

Using Playwright when environment permits:

- `/app` loads into fit-project view;
- wheel/trackpad panning does not page-scroll unexpectedly over canvas;
- Space + drag pans;
- node click selects;
- Enter focuses;
- Esc restores viewport;
- inspector can resize and close;
- command palette does not steal text input shortcuts;
- reduced-motion mode avoids long transitions;
- mobile uses focused boards, not unusable desktop canvas.

### 26.4 Regression tests

Keep the current `frontend:verify` suite and expand it. Runtime TypeScript/Next/Vitest/build verification remains mandatory before claiming the implementation complete.

---

## 27. Visual QA matrix

Mandatory viewport checks:

- 1366 × 768 laptop.
- 1440 × 900 laptop/desktop.
- 1920 × 1080 desktop.
- ~1024 px tablet landscape.
- ~768 px tablet portrait.
- 390 × 844 phone.

At each desktop viewport verify:

- workboards do not overlap initial UI chrome;
- minimap/controls never cover essential content;
- inspector opening reduces usable canvas predictably;
- fit-project remains useful;
- top bar remains readable at zoom extremes;
- canvas world text does not become illegibly tiny at minimum zoom.

---

## 28. Migration order

The redesign should be implemented in vertical slices rather than converting every route at once.

### Phase A — Foundation

- dependency setup;
- WorkbenchShell;
- ToolRail;
- TopBar;
- React Flow canvas;
- dotted graphite canvas;
- state store;
- controls;
- focus/selection/inspector skeleton;
- accessibility foundation.

### Phase B — Spatial Home

- snapshot adapter from current `thisWeek()` data;
- six workboards;
- deterministic composition;
- macro Trace edges;
- capture launcher;
- mobile focused-board alternative.

At the end of Phase B `/app` must already feel like the supplied Stitch-style reference rather than a normal dashboard.

### Phase C — Fine-grained Evidence Trace

- replace fixed SVG graph with React Flow;
- ELK layout;
- filters;
- shared inspector;
- semantic alternative list/table;
- performance validation.

### Phase D — Timeline + Capture polish

- spatial/horizontal desktop timeline;
- shared inspector;
- capture overlay integration;
- post-capture workbench refresh/appearance.

### Phase E — Secondary-route coherence

- compact route frame;
- command palette integration;
- remove unnecessary permanent nav duplication;
- ensure Tests/Decisions/Memory/Competition/Exports visually belong to the same product without forcing every route onto a canvas.

### Phase F — Motion, performance, accessibility, browser QA

- full interaction regression pass;
- reduced motion;
- viewport stress tests;
- touch/keyboard QA;
- build/typecheck/lint/test verification;
- final visual polish.

---

## 29. Explicit non-goals

The spatial redesign does **not** include:

- arbitrary user-created graph edges on the home workbench;
- workflow automation execution;
- free-form drawing tools;
- text sticky notes as a primary product feature;
- collaboration cursors;
- multiplayer canvas editing;
- AI-generated board placement as a source of truth;
- 3D/WebGL canvas;
- animated decorative background;
- replacing existing evidence-domain queries with a new backend;
- deleting canonical detail routes.

These would increase complexity without improving TraceLab's core evidence loop.

---

## 30. Success criteria

The redesign is successful when a new user can open `/app` and understand, without reading a sidebar list:

1. which source work needs their human rationale;
2. which iteration is currently active;
3. what test happened and what it found;
4. what decision followed;
5. where to capture new evidence;
6. how to zoom into an object and inspect provenance;
7. how to return to the project overview.

Qualitatively, the product should feel like a calm engineering desktop that contains several live work surfaces, not a conventional SaaS dashboard with a dark dotted background pasted behind cards.

The defining visual signature is **bright evidence workboards connected by restrained Trace relationships on a graphite project canvas**.

---

## 31. Source provenance ledger for reference implementation

No source code from the reference repositories should be copied without recording provenance. For any adapted non-trivial implementation:

```text
Source repo:
Source path:
Source commit/version:
License:
Mechanic adapted:
TraceLab destination:
Date:
```

Current license review from supplied repositories:

- XYFlow: MIT.
- Excalidraw: MIT.
- Langflow: MIT.
- Activepieces inspected non-EE builder code: repository license states content outside listed EE paths is MIT Expat; do not copy from EE paths.

Prefer reimplementation from documented/public APIs and observed mechanics over source-level copying.

---

## 32. Final design decision

The first implementation target is not “make all routes beautiful.” It is one uncompromised vertical experience:

```text
/app Spatial Workbench
→ Needs Context board
→ Active Iteration board
→ Test Bench
→ Decision Trail
→ select/focus
→ shared Inspector
→ Capture launcher
→ return to overview
```

Once this interaction feels excellent at 1366×768 and 1440×900, the same architecture expands to Trace, Timeline, and secondary routes.

This ordering prevents spending time polishing secondary pages while the core spatial mental model is still wrong.
