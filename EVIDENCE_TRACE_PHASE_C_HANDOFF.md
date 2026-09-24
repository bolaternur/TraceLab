# TraceLab Spatial Workbench — Phase C: Evidence Trace handoff

Date: 2026-09-04

## Phase goal

Replace the legacy hand-built fixed SVG graph with a bounded, read-only, spatial Evidence Trace that preserves real engineering provenance and causal relationships.

The resulting Trace is a power view, not a workflow editor. It visualizes stored evidence; it does not author, invent or mutate relationships.

## What changed

### Server → client contract

`/app/graph` still gets authoritative data from `evidenceGraph(teamId, ...)`, but no raw `Date`/Drizzle-shaped graph objects are passed directly into interactive UI.

The server now builds one serializable `EvidenceTraceSnapshot` through:

```text
src/components/evidence-trace/model.ts
```

The client snapshot contains only primitives:

```text
nodes[]
  id
  kind: source_event | iteration | test | decision
  label
  detail
  occurredAt: ISO string | null
  subsystemId
  outcome
  provider

relations[]
  id
  fromId
  toId
  type
  origin
  status
```

Unknown entity kinds are omitted. Invalid/absent dates normalize to `null`. Duplicate `(from,to,type)` relation triples are removed.

### Read-only React Flow canvas

The previous `<svg>` layout in `src/app/app/graph/graph-view.tsx` is gone.

Desktop now uses `@xyflow/react` with:

- custom evidence nodes;
- custom Trace relation edges;
- no connection editing;
- `nodesDraggable={false}`;
- no delete action;
- no perpetual animated edges;
- pan/zoom/select conventions shared with Spatial Home;
- bounded visible set (existing 30-object cap remains);
- selection → first-order neighborhood emphasis;
- double click / Enter → camera focus;
- Esc → previous viewport / clear selection;
- F / 0 → fit trace;
- 1 → 100%;
- `?` → keyboard help;
- optional minimap;
- `onlyRenderVisibleElements`.

### ELK layered layout + deterministic fallback

`elkjs@0.9.3` was added as a dependency.

Evidence Trace renders immediately with TraceLab's deterministic semantic fallback layout:

```text
source_event → iteration → test → decision
```

Then ELK performs a layered placement for denser graphs. If ELK fails, fallback positions remain valid.

After asynchronous ELK placement, the canvas waits for React paint and refits the viewport. This prevents the common failure where nodes move after the initial `fitView` and appear off-screen.

### Stored direction vs visual reading direction

Database relation direction is never mutated.

Some structural relations are stored in a direction that is natural for the relational model (for example test → iteration), while the engineering reading path is easier to understand as iteration → test.

`visualRelationEndpoints()` derives presentation-only left-to-right endpoints from semantic entity order. The original `fromId` / `toId`, relation type, status and origin remain unchanged and are used in inspector/accessibility views.

### Semantic node system

There are explicit node presentations for:

- Source event
- Iteration
- Test
- Decision

Source nodes preserve provider identity. Test/Decision nodes surface outcome/disposition text. Every node has direct `Inspect` and `Why?` deep links.

### Relation semantics

Accepted vs suggested is not color-only:

- accepted → solid edge + `Accepted` text in semantic explorer;
- suggested → dashed edge + explicit `Suggested` label;
- origin remains visible in inspector/list.

No edge uses continuous animation.

### Inspector

Desktop inspector lives outside the React Flow transformed DOM.

It shows:

- selected entity type/title;
- recorded date;
- provider/outcome;
- first-order inbound/outbound relations;
- relation human label;
- status;
- origin;
- navigation to related entities;
- Inspect / Why? deep links.

### Accessibility and mobile

The canvas is not the only representation.

A permanent semantic **Relation explorer** renders outside React Flow as a real table with:

```text
From | Relationship | To | Status | Origin
```

Mobile intentionally does **not** render a tiny infinite React Flow canvas. It uses a focused evidence-card strip plus first-order relation detail.

### Route filters preserved

Existing query semantics remain:

```text
/app/graph?subsystem=...
/app/graph?relation=...
/app/graph?days=7|30|90
```

The 30-object bound remains. If more objects match, TraceLab asks the user to narrow the trace instead of rendering visual spaghetti.

## New files

```text
src/components/evidence-trace/
├── elk-layout.ts
├── layout.ts
├── model.ts
├── presentation.ts
├── trace-canvas.tsx
├── trace-controls.tsx
├── trace-edge.tsx
├── trace-inspector.tsx
├── trace-list.tsx
├── trace-mobile.tsx
├── trace-node.tsx
└── types.ts
```

Also changed:

```text
src/app/app/graph/page.tsx
src/app/app/graph/graph-view.tsx
src/components/workbench/secondary-route-frame.tsx
src/server/evidence.ts
src/app/globals.css
package.json
tests/frontend-contract.node.test.ts
tests/evidence-trace-model.node.test.ts
docs/frontend/THIRD_PARTY_SOURCE_LEDGER.md
```

## Fresh verification in artifact environment

Final dependency-free gate on the Phase C code tree:

```text
frontend contracts: 51 passed / 0 failed
pure model tests: 11 passed / 0 failed
static accessibility/motion audit: PASS across 123 source files
TypeScript/TSX transpile-syntax pass: 130 files / 0 syntax errors
```

Command:

```bash
npm run frontend:verify
```

## Full runtime verification limitation

The artifact environment still cannot resolve npm registry DNS.

Fresh probe:

```text
npm view elkjs@0.9.3 version
→ EAI_AGAIN registry.npmjs.org
```

Therefore this handoff does **not** claim successful framework-level:

```text
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Run those on your Arch machine where npm access works.

## Upgrade your current local TraceLab without losing DB/auth config

If your current working folder is:

```text
~/Documents/tracelab_frontend_build
```

keep its `.env` and `.env.local` safe before replacing the code:

```bash
cd ~/Documents
cp tracelab_frontend_build/.env /tmp/tracelab.env 2>/dev/null || true
cp tracelab_frontend_build/.env.local /tmp/tracelab.env.local 2>/dev/null || true
```

Extract the new Phase C archive as a separate folder first. Then restore your environment files into the new project folder:

```bash
cp /tmp/tracelab.env NEW_FOLDER/.env 2>/dev/null || true
cp /tmp/tracelab.env.local NEW_FOLDER/.env.local 2>/dev/null || true
```

Your PostgreSQL data does not live inside the project ZIP, so do not delete/recreate the database.

Then:

```bash
cd NEW_FOLDER
npm install
npm run frontend:verify
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

`npm install` will install the new `elkjs` dependency together with existing Spatial Workbench dependencies.

If your local-only fake auth is desired, `.env.local` can retain:

```text
DEV_AUTH_BYPASS=true
DEV_AUTH_EMAIL=lead@trace.demo
```

The bypass remains guarded by `NODE_ENV === "development"` in code.

## Manual browser QA after install

Open:

```text
/app/graph
```

Check:

1. graph initially fits in viewport;
2. source → iteration → test → decision reads left-to-right;
3. click a node → unrelated nodes/edges dim;
4. inspector shows real first-order relations;
5. suggested relation is dashed and explicitly says Suggested;
6. double-click node → focus;
7. Esc restores prior viewport;
8. F / 0 fits graph;
9. filters still work;
10. mobile width shows focused cards rather than React Flow;
11. Relation explorer remains keyboard/screen-reader navigable;
12. reduced-motion removes camera animation.

## Deliberately deferred

Not part of Phase C:

- creating/editing relation edges from the graph;
- persisted user graph positions;
- Engineering Timeline spatial rewrite;
- floating Capture-on-canvas flow;
- URL-synchronized selected evidence (`?focus=` style state);
- browser screenshot/visual-regression pass, pending installed dependencies.

Those remain separate phases so Evidence Trace can be reviewed independently.
