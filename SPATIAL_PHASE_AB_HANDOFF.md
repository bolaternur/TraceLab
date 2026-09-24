# TraceLab Spatial Workbench — Phase A+B Handoff

Date: 2026-09-04
Scope: spatial foundation + primary `/app` workbench + mobile focused-workboard fallback.

## What changed

The primary authenticated route is no longer a normal dashboard/list page. `/app` is now a full-height Spatial Evidence Workbench built around six coarse engineering workboards:

- Needs your context
- Active iteration
- Recent evidence
- Test bench
- Decision trail
- Process health

The desktop shell uses a compact ToolRail, a graphite dotted React Flow canvas, asymmetric draggable workboards, quiet Trace edges, canvas controls, selection/focus/escape semantics, a resizable right inspector, persisted per-team/season board positions, and reduced-motion-aware camera transitions.

Mobile does not render a miniature infinite canvas. It uses horizontal snap-focused workboards and an on-demand bottom inspector while retaining the existing global capture/navigation surface.

## Architecture boundaries

Server/domain authority remains unchanged. `/app` loads team/policy/evidence/tests/decisions on the server, converts raw Drizzle query shapes through `buildWorkbenchSnapshot()`, and passes one serializable snapshot into the client workbench.

The complete snapshot is not duplicated inside every React Flow node. React Flow node data carries only the semantic board kind; one `WorkbenchSnapshotProvider` supplies evidence presentation data. Zustand stores transient canvas state and persisted board coordinates only, never authoritative evidence data.

## Important runtime hardening included

This package includes the local-runtime fixes discovered while running the previous frontend:

1. `today-model.ts` accepts the real nested `{ ev, actor, subsystem }` shape and no longer calls `.getTime()` on an absent top-level field.
2. `drizzle.config.ts` reads `DATABASE_URL` from `.env.local` / `.env`, so Drizzle commands and the Next application target the same database.
3. Database scripts explicitly use `drizzle.config.ts`.
4. Optional local auth bypass is built into `getCurrentUser()` but is guarded by BOTH:
   - `NODE_ENV === "development"`
   - `DEV_AUTH_BYPASS === "true"`
5. `.env.example` ships with `DEV_AUTH_BYPASS=false`.

## New dependencies

- `@xyflow/react` 12.11.6
- `motion` 12.35.0
- `react-resizable-panels` 4.7.0
- `zustand` ^4.5.7

Existing Next/React/Drizzle/PostgreSQL stack is preserved.

## Local upgrade from the frontend you already have running

Extract this checkpoint into a NEW folder instead of overwriting your currently working folder first.

Copy the already-working environment files from the old project into the new folder:

```bash
cp ../tracelab_frontend_build/.env .
cp ../tracelab_frontend_build/.env.local .
```

If your PostgreSQL container is the one previously created on host port 5433, keep:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5433/app_db
```

For local UI development without signing in:

```env
DEV_AUTH_BYPASS=true
DEV_AUTH_EMAIL=lead@trace.demo
```

Then install the new canvas dependencies and sync the schema:

```bash
npm install
npm run db:push
npm run db:seed
```

Run the dependency-free verification first:

```bash
npm run frontend:verify
```

Then run the framework/runtime gates on your machine:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Finally:

```bash
npm run dev
```

If port 3000 is still occupied, Next will use 3001. Open the exact Local URL printed by Next, usually:

```text
http://localhost:3001/app
```

## Interaction model

Desktop:

- wheel/trackpad: pan
- Space + drag: pan
- middle/right drag: pan
- Meta/Ctrl + wheel: zoom
- drag empty area: selection box
- click board: select + inspector
- double click board or Enter on selected board: focus camera
- Esc: restore previous viewport, then clear selection
- F or 0: fit project
- 1: 100% zoom
- ?: keyboard help
- Cmd/Ctrl+K: command palette

Workboard internal scroll/link areas use XYFlow `nodrag/nopan`; the visible board header remains the drag affordance.

## Fresh checkpoint verification (2026-09-04)

The final dependency-free gate was run on the exact tree packaged for Phase A+B:

```text
frontend contracts: 45 passed / 0 failed
workbench model tests: 4 passed / 0 failed
static accessibility/motion audit: PASS across 111 source files
TypeScript/TSX transpile-syntax pass: 117 files / 0 syntax errors
```

Command:

```bash
npm run frontend:verify
```

## Verification available in the build environment

`npm run frontend:verify` runs:

1. frontend semantic/architecture contracts;
2. pure workbench model tests;
3. static accessibility/motion audit;
4. TypeScript/TSX syntax-transpile pass.

A full Next/TypeScript/Vitest/build gate was not possible in the artifact environment because DNS access to `registry.npmjs.org` returned `EAI_AGAIN`, and the uploaded ZIP did not include `node_modules`.

Do not treat the checkpoint as production-build-verified until the commands under **Local upgrade** pass on a machine with npm registry access.

## Main new/changed workbench files

```text
src/components/workbench/
├── canvas-controls.tsx
├── inspector-host.tsx
├── layout.ts
├── mobile-workbench.tsx
├── secondary-route-frame.tsx
├── snapshot.ts
├── spatial-canvas.tsx
├── state.ts
├── store.ts
├── tool-rail.tsx
├── trace-edge.tsx
├── types.ts
├── workbench-context.tsx
├── workbench-shell.tsx
├── workbench-top-bar.tsx
├── workboard-content.tsx
└── workboard-node.tsx
```

Also changed:

- `src/app/app/page.tsx`
- `src/app/app/layout.tsx`
- `src/app/globals.css`
- `src/server/auth.ts`
- `src/components/tracelab/today-model.ts`
- `src/components/tracelab/command-palette.tsx`
- `drizzle.config.ts`
- `.env.example`
- `package.json`
- frontend/model tests and static audit scripts

## What intentionally remains for the next phases

This checkpoint does NOT yet claim that every secondary route has become spatial.

Next independent subsystems are:

1. Evidence Trace — replace the older fixed SVG graph with React Flow + semantic node/edge types + accessible list fallback + ELK layout.
2. Engineering Timeline — spatial/horizontal causal timeline rather than the current long secondary page.
3. Capture — floating canvas launcher / morphing capture surface / evidence insertion feedback.
4. URL focus/deep-link synchronization and heavier provenance inspector loading.
5. Browser visual QA at 1366×768, 1440×900, 1920×1080, tablet and phone after dependencies are installed.

The current checkpoint is deliberately reviewable on its own: Spatial Home can be accepted or corrected before those subsystems inherit its interaction model.
