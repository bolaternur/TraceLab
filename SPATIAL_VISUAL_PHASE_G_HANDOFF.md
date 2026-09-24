# TraceLab Spatial Workbench — Phase G Visual QA & Composition Handoff

Date: 2026-09-04

## Goal

Phase G changes the *visual composition* of Spatial Home without changing backend/domain semantics. The target is closer to Google Stitch + n8n: a dark spatial world containing independent white engineering artboards, not a conventional dashboard whose cards happen to sit on a canvas.

## What changed

### 1. Hero-first spatial composition

`Active iteration` is now the largest central artboard. The surrounding boards are deliberately offset and separated rather than forming rows/columns:

- Needs your context: left / upper
- Active iteration: central hero
- Recent evidence: right / upper
- Test bench: lower-left
- Decision trail: lower-center
- Process health: lower-right

Layout storage version moved to v2 so old user-dragged positions do not silently override the new composition.

### 2. Workboards now look like artboards

Removed the old full-height colored stripe. Tone is now expressed through a small artboard label marker. Borders and shadows are quieter, with a restrained selected state.

### 3. Removed dashboard/list thinking inside boards

`Active iteration` no longer renders a 3-card KPI grid. It now renders the actual engineering loop:

Source → Why → Test → Decision

Recent evidence, tests, and decisions use small evidence tile clusters with a featured item rather than long vertical lists. Process health uses compact status cells instead of metric rows.

### 4. Split floating chrome

The previous one-piece toolbar was replaced by two floating pieces:

- project/team context pill on the left
- policy/capture action cluster on the right

This leaves visible canvas between controls and makes the shell feel like a design tool rather than a website header.

### 5. Unified dark inspector

Spatial Home Inspector now visually belongs to the same dark world as Evidence Trace and Timeline. White/light surfaces are reserved for evidence/artboards and the primary action, not the whole inspector panel.

### 6. Initial viewport + mobile hierarchy

Desktop initial `fitView` now uses more breathing room and caps overview zoom at `0.82`. Mobile starts with Active Iteration first, followed by missing context and recent evidence. The mobile inspector no longer shows a miniature KPI grid.

## Regression rules added

Static audit now fails if Spatial Home reintroduces:

- a three-KPI grid in Active Iteration;
- missing evidence-loop/tile composition primitives;
- `.workbench-board::before` full-height accent stripes;
- non-artboard workboard headers;
- one-piece/full-width workbench toolbar;
- a light detached workbench Inspector.

## Source-level verification

Run:

```bash
npm run frontend:verify
```

This checks contract tests, pure model tests, static a11y/motion/design audit, and TS/TSX syntax transpilation without fetching dependencies.

## Full local framework gate

On a machine with npm registry access:

```bash
npm install
npm run frontend:verify
npm run typecheck
npm run lint
npm test
npm run build
```

The registry probe in the build container timed out, so the framework-level gate is intentionally not claimed here.

## Browser visual QA checklist

Open `/app` at each size and send screenshots if a second pixel pass is desired:

- 1366×768
- 1440×900
- 1920×1080
- ~1024px tablet width
- 390×844 mobile

Check the following:

1. Active Iteration should visually dominate without filling the whole viewport.
2. At 1366×768 all six boards should read as a coherent constellation after initial fit, not as tiny thumbnails.
3. Context and action chrome should feel detached from the canvas and must not read as a full website header.
4. White artboards should be visually flatter than modal/dialog surfaces.
5. No board should look like a KPI dashboard.
6. Selecting a board should produce a clear but restrained focus ring/shadow.
7. Opening the Inspector must not shrink the canvas to an unusable scale.
8. Recent Evidence/Test/Decision tiles should remain scannable at the initial zoom.
9. ToolRail icons should remain legible and not visually compete with the artboards.
10. Mobile should open on Active Iteration and preserve one obvious Capture action.

## Files primarily changed in Phase G

- `src/components/workbench/layout.ts`
- `src/components/workbench/workboard-node.tsx`
- `src/components/workbench/workboard-content.tsx`
- `src/components/workbench/workbench-top-bar.tsx`
- `src/components/workbench/inspector-host.tsx`
- `src/components/workbench/mobile-workbench.tsx`
- `src/components/workbench/spatial-canvas.tsx`
- `src/app/globals.css`
- `scripts/frontend-static-audit.mjs`
- `tests/frontend-contract.node.test.ts`
- `tests/workbench-model.node.test.ts`

## Product semantics unchanged

Phase G does not alter:

- authentication or membership checks;
- PostgreSQL/Drizzle schema;
- evidence provenance;
- relation direction;
- capture/offline outbox;
- competition policy;
- authoring rules;
- Evidence Trace data model;
- Timeline data model.
