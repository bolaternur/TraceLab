# Evidence Trace React Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy fixed SVG Evidence Trace with a bounded, evidence-faithful React Flow power view using typed serializable graph data, deterministic layered layout, contextual inspection, and a complete accessible semantic fallback.

**Architecture:** The server remains authoritative for graph entities and relations. `evidenceGraph()` produces domain rows; a pure adapter converts them to a client-safe `EvidenceTraceSnapshot`; a pure layout module turns that snapshot into deterministic layered positions. The client React Flow surface consumes only that snapshot and transient selection/viewport state. It never creates or persists evidence relations. Suggested relations remain visually and semantically distinct from accepted relations.

**Tech Stack:** Next.js 16.2.6, React 19.2.6, TypeScript 5.9.3, `@xyflow/react` 12.11.6, `elkjs` 0.10.x/compatible current release, Tailwind CSS 4, existing TraceLab design tokens, Node built-in test runner for dependency-free model/contract tests.

**Spec:** `docs/superpowers/specs/2026-09-04-spatial-workbench-design.md`

## Global Constraints

- Evidence Trace is a controlled causal/provenance power view, not a freeform workflow editor.
- Only real database relations and existing structural foreign-key relations may render as edges. No AI-invented connections.
- Accepted and suggested relations must be distinguishable by text/style, not color alone.
- Source event, iteration, test, and decision nodes must have distinct semantic presentation.
- Node/edge labels remain readable at normal zoom; detail is progressively disclosed in the inspector.
- Default graph remains bounded. Filters are preferred over rendering visual spaghetti.
- Desktop uses React Flow; small screens receive a semantic focused/list representation rather than a miniature infinite canvas.
- Keyboard and screen-reader users must be able to traverse the same entities and relations without the canvas.
- `prefers-reduced-motion` must remove camera animation and non-essential edge transition.
- The graph must preserve existing deep links to source event/inbox, iterations, tests, decisions, and Why?.
- No evidence mutation is implemented in this phase.
- Existing `/app/graph` search params `subsystem`, `relation`, and `days` remain supported.

---

### Task 1: Typed Evidence Trace snapshot adapter

**Files:**
- Create: `src/components/evidence-trace/types.ts`
- Create: `src/components/evidence-trace/model.ts`
- Create: `tests/evidence-trace-model.node.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: server `GraphNode[]` and `GraphEdge[]` shape from `src/server/evidence.ts` after page-level filtering/serialization.
- Produces: `EvidenceTraceSnapshot`, `EvidenceTraceNode`, `EvidenceTraceRelation`, `buildEvidenceTraceSnapshot()`.

- [x] **Step 1: Write failing pure model tests**

Cover:
1. `Date | string | null | undefined` normalizes to ISO string or `null` without `.getTime()` assumptions.
2. unknown entity types are rejected/omitted rather than rendered as source events.
3. duplicate relation triples do not duplicate accessible relation rows.
4. selected-focus neighborhood can be derived without mutating the snapshot.
5. deep-link resolution is deterministic per entity type.

- [x] **Step 2: Run RED**

```bash
node --experimental-strip-types --test tests/evidence-trace-model.node.test.ts
```

Expected: module-not-found / missing exported model functions.

- [x] **Step 3: Implement immutable serializable types and adapter**

Use exact entity kind union:

```ts
type EvidenceTraceKind = "source_event" | "iteration" | "test" | "decision";
```

Client dates are `string | null`; node outcome/state/provider remain strings/null, never Drizzle objects.

- [x] **Step 4: GREEN**

Run the pure model suite until all tests pass.

- [x] **Step 5: Add model suite to `frontend:model`**

Make `npm run frontend:model` run both workbench and evidence-trace pure suites.

---

### Task 2: Deterministic layered graph layout

**Files:**
- Create: `src/components/evidence-trace/layout.ts`
- Modify: `tests/evidence-trace-model.node.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `EvidenceTraceSnapshot`.
- Produces: `layoutEvidenceTrace(snapshot)` returning positioned nodes and edges plus graph bounds.

- [x] **Step 1: Add failing layout tests**

Assert:
- default column order `source_event → iteration → test → decision`;
- graph positions are stable regardless of input array order;
- every node receives finite x/y coordinates;
- graph bounds stay finite for empty/single/multi-node snapshots;
- suggested/accepted state never changes placement ordering;
- isolated entities remain visible.

- [x] **Step 2: Run RED**

Run the evidence-trace model suite.

- [x] **Step 3: Implement a synchronous deterministic fallback layout**

Use semantic layers and stable date/id ordering so the graph renders immediately and remains testable without browser/dependencies.

- [x] **Step 4: Add ELK dependency for browser enhancement**

Add `elkjs` to dependencies. The client may later request an ELK layered layout for dense graphs, but the synchronous semantic fallback remains authoritative for first render and tests.

- [x] **Step 5: GREEN**

Run pure model tests.

---

### Task 3: Trace semantic nodes and edges

**Files:**
- Create: `src/components/evidence-trace/trace-node.tsx`
- Create: `src/components/evidence-trace/trace-edge.tsx`
- Create: `src/components/evidence-trace/presentation.ts`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Node data contains only its corresponding `EvidenceTraceNode`, not the entire graph snapshot.
- Edge data contains relation type/origin/status and selected-neighborhood state only.

- [x] **Step 1: Add failing component contracts**

Assert:
- four explicit semantic node kinds are supported;
- source identity/provider is shown for source nodes;
- outcome/disposition text is present for test/decision nodes;
- suggested relation has visible `Suggested` semantics and dashed styling;
- edge `animated` is never enabled;
- node content has direct deep-link and `Why?` affordances without turning the whole graph into an editor.

- [x] **Step 2: Confirm RED**

Run `npm run frontend:contract`.

- [x] **Step 3: Implement presentation helpers**

Centralize kind labels, icons, tone classes, relation human labels, status/origin labels and href generation.

- [x] **Step 4: Implement custom node**

The node has compact technical metadata, a semantic type rail, selection/focus outline, source/provider or outcome metadata, and `nodrag` links.

- [x] **Step 5: Implement custom edge**

Use a custom bezier/smooth-step edge with relation label shown only for selected/focused neighborhood or suggested state. Suggested edges are dashed; accepted edges are solid. No perpetual animation.

- [x] **Step 6: GREEN**

Run contract and static audit suites.

---

### Task 4: React Flow Evidence Trace canvas

**Files:**
- Replace: `src/app/app/graph/graph-view.tsx`
- Create: `src/components/evidence-trace/trace-canvas.tsx`
- Create: `src/components/evidence-trace/trace-controls.tsx`
- Create: `src/components/evidence-trace/trace-inspector.tsx`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Consumes one `EvidenceTraceSnapshot`.
- Selection/focus/viewport are client-only state.
- Produces no server mutations.

- [x] **Step 1: Add failing canvas contracts**

Assert React Flow configuration uses:
- no connection handles / no connect-on-click editing;
- bounded min/max zoom;
- selection/pan conventions matching Spatial Workbench;
- custom node/edge types;
- `fitView` with reduced-motion-aware duration;
- `onlyRenderVisibleElements`;
- `nodesDraggable={false}` for Evidence Trace in this phase;
- controls for Fit, 100%, Help; optional minimap only at adequate viewport size.

- [x] **Step 2: Confirm RED**

Run contracts.

- [x] **Step 3: Implement canvas**

Convert pure positioned model into React Flow nodes/edges. Keep graph read-only. Selecting a node highlights its first-order neighborhood and dims unrelated graph elements.

- [x] **Step 4: Implement focus camera**

Double click or Enter on selected node focuses it; Esc restores previous viewport/clears focus. Reduced-motion makes camera changes immediate.

- [x] **Step 5: Implement inspector**

Inspector displays entity type, label, metadata, explicit inbound/outbound relation list, relation status/origin, and deep links. It is not part of the React Flow transform layer.

- [x] **Step 6: GREEN**

Run contracts/audit/syntax.

---

### Task 5: Accessible relation explorer and mobile fallback

**Files:**
- Create: `src/components/evidence-trace/trace-list.tsx`
- Create: `src/components/evidence-trace/trace-mobile.tsx`
- Modify: `src/components/evidence-trace/trace-canvas.tsx`
- Modify: `tests/frontend-contract.node.test.ts`

**Interfaces:**
- Consumes same immutable `EvidenceTraceSnapshot`.
- Produces semantic list/tree-like traversal and relation table independent of the canvas DOM.

- [x] **Step 1: Add failing accessibility/mobile contract**

Assert:
- canvas has a textual graph summary;
- semantic node list is always available to assistive technology;
- mobile does not render a miniature React Flow canvas;
- every relation row states source label, human relation label, target label, and accepted/suggested status;
- selected/focused mobile entity exposes first-order relations and deep links.

- [x] **Step 2: Confirm RED**

Run contracts.

- [x] **Step 3: Implement semantic explorer**

Use buttons/links/lists/table semantics. Do not hide the only accessible representation behind `<details>`.

- [x] **Step 4: Implement mobile focused trace**

Use horizontally/focused entity cards + relation list/bottom detail surface rather than React Flow.

- [x] **Step 5: GREEN**

Run static audit and contracts.

---

### Task 6: Route migration and filter integration

**Files:**
- Modify: `src/app/app/graph/page.tsx`
- Modify: `src/app/app/graph/graph-view.tsx`
- Modify: `tests/frontend-contract.node.test.ts`
- Modify: `SPATIAL_PHASE_AB_HANDOFF.md` only to point to the next artifact, if needed.

**Interfaces:**
- Server keeps `subsystem`, `relation`, `days` query semantics.
- Server creates `EvidenceTraceSnapshot` after filtering/clipping.
- Client receives no Date objects.

- [x] **Step 1: Add failing route contract**

Assert the page builds a trace snapshot, keeps filters, keeps the 30-node bounded default, and renders the new GraphView/Trace surface.

- [x] **Step 2: Confirm RED**

Run contract suite.

- [x] **Step 3: Migrate route**

Keep existing empty state and filter UI but update surrounding visual shell to fit Spatial Workbench language. Serialize once through the adapter.

- [x] **Step 4: Preserve no-spaghetti clipping behavior**

If more than 30 nodes match, keep the explanatory warning and ask user to narrow filters.

- [x] **Step 5: GREEN**

Run the full dependency-free verification.

---

### Task 7: Verification, handoff, and checkpoint artifact

**Files:**
- Create: `EVIDENCE_TRACE_PHASE_C_HANDOFF.md`
- Modify: `docs/superpowers/plans/2026-09-04-evidence-trace-react-flow.md`

**Interfaces:**
- Produces a reviewable Phase C artifact without claiming browser/runtime verification that did not run.

- [x] **Step 1: Run fresh dependency-free gate**

```bash
npm run frontend:verify
```

Record exact pass/fail counts.

- [ ] **Step 2: Try full dependency/runtime gate if registry is available**

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

If npm registry still returns `EAI_AGAIN`, record that exact limitation instead of claiming success.

- [x] **Step 3: Write handoff**

Document interaction model, files changed, data contract, accessible fallback, local commands, and known runtime verification state.

- [x] **Step 4: Package ZIP and verify integrity**

Exclude `node_modules`, `.next`, `.git`, coverage/build outputs. Run `unzip -t` and SHA-256.

---

## Self-review

- Spec coverage: typed server→client graph, deterministic bounded layout, custom semantic nodes/edges, selection/focus/inspector, desktop canvas, mobile fallback, accessible relation explorer, filters and clipping are all mapped to tasks.
- Scope: relation editing, timeline, canvas capture, and persisted graph positioning are intentionally excluded from Phase C.
- Type consistency: all client graph surfaces consume `EvidenceTraceSnapshot`; React Flow node/edge conversion happens only in `trace-canvas.tsx`.
- Licensing: `@xyflow/react` is already tracked from the Phase A+B reference set; `elkjs` is dependency-only and its license notice must remain in dependency metadata/lockfile.
