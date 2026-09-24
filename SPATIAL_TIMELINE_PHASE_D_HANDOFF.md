# TraceLab Spatial Engineering Timeline — Phase D Handoff

Date: 2026-09-04

## Scope completed

Phase D replaces the legacy grouped Timeline with a spatial, horizontal engineering-history surface while keeping `subsystemTimeline()` server-authoritative and preserving a chronological mobile/accessibility path.

Phase D is intentionally not a second graph editor. Time controls horizontal distance; stored iteration membership is shown as a presentation overlay; Evidence Trace remains the causal graph view.

## Architecture

```text
PostgreSQL / Drizzle
        ↓
subsystemTimeline(teamId, subsystemId, range)
        ↓
buildEngineeringTimelineSnapshot()
        ↓
ISO-string, serializable EngineeringTimelineSnapshot
        ↓
TimelineView client boundary
        ├─ desktop TimelineSurface
        ├─ docked TimelineInspector
        ├─ mobile chronological TimelineMobile
        └─ semantic TimelineList
```

No raw Drizzle `Date` crosses into Timeline client code.

## Desktop interaction model

The desktop Timeline is a bounded horizontal time world with four semantic lanes:

- Source
- Iteration
- Test
- Decision

Event cards retain a fixed semantic size. `Month`, `Day`, and `Detail` change time spacing and source-event density, not decorative card scale.

Keyboard behavior:

- `← / →` scroll through time
- `↑ / ↓` select previous / next displayed evidence
- `Enter` focus selected evidence
- `F` or `0` fit the full history
- `Esc` clear focus / selection
- `?` open Timeline shortcuts

Focus scrolling respects `prefers-reduced-motion`.

## Density semantics

`detail` keeps every authoritative Timeline item visible.

`day` can aggregate only dense source-event bursts. Tests, decisions, and iteration boundaries remain individual evidence objects.

`month` can aggregate same-day source noise while preserving the same semantic exceptions.

A burst retains:

- member evidence ids
- provider set
- first / last time
- subsystem
- iteration membership where recorded

Deep-linking to one source event inside an aggregated burst resolves to the visible burst for camera focus, while the inspector still keeps the authoritative evidence id and real entity link.

## Iteration bands

Iteration bands are visual overlays only. They are derived from real shared `iterationId` membership and never mutate or invent relations.

The band title comes from the matching recorded iteration-open event where available.

## Cross-surface focus continuity

Timeline and Evidence Trace now share validated `focus=<id>` deep links.

Timeline route validates `focus` against the normalized Timeline snapshot before initializing selection.

Evidence Trace validates `focus` against its bounded visible node snapshot.

Examples:

```text
/app/timeline?subsystem=<id>&focus=<source-or-test-or-decision-id>
/app/graph?subsystem=<id>&focus=<same-entity-id>
```

A Trace iteration node maps to its recorded Timeline open boundary:

```text
Trace iteration id: <iteration-id>
Timeline focus id: <iteration-id>-open
```

A Timeline `iteration_open` / `iteration_close` maps back to the real Trace iteration id.

Trace initial focus waits for async ELK placement to settle and paint before the camera focuses the node. It does not focus fallback coordinates and then let ELK move the target away.

## Inspector truth rules

Timeline Inspector displays only stored facts:

- recorded time
- provider
- event type
- subsystem id
- stored iteration membership
- authoritative entity href

`Open in Trace` carries subsystem + a real trace-focus id where possible.

Evidence Trace Inspector now includes a `Timeline` bridge carrying the selected evidence id. Mobile Trace exposes the same bridge.

## Mobile

Mobile does not receive a miniature horizontal canvas.

It uses:

- chronological day groups
- ordered semantic list structure
- 44px minimum interaction targets
- on-demand bottom inspector
- real Inspect and focused Trace links

This preserves the product rule: desktop is for understanding; mobile is for fast evidence access/capture-oriented work.

## Accessibility

The visual Timeline is supplemented by `Chronological explorer`, an ordered semantic representation containing real entity links.

Static audit checks continue to enforce:

- explicit accessible labels for icon-first controls
- reduced-motion coverage
- focus-visible states
- target-size floor on mobile
- no perpetual decorative motion

## Important files

### Server / route

- `src/server/evidence.ts`
- `src/app/app/timeline/page.tsx`
- `src/app/app/timeline/timeline-view.tsx`

### Timeline domain / layout

- `src/components/engineering-timeline/types.ts`
- `src/components/engineering-timeline/model.ts`
- `src/components/engineering-timeline/layout.ts`
- `src/components/engineering-timeline/presentation.ts`

### Timeline presentation

- `src/components/engineering-timeline/timeline-surface.tsx`
- `src/components/engineering-timeline/timeline-event-card.tsx`
- `src/components/engineering-timeline/timeline-controls.tsx`
- `src/components/engineering-timeline/timeline-inspector.tsx`
- `src/components/engineering-timeline/timeline-mobile.tsx`
- `src/components/engineering-timeline/timeline-list.tsx`

### Cross-surface focus additions

- `src/app/app/graph/page.tsx`
- `src/app/app/graph/graph-view.tsx`
- `src/components/evidence-trace/trace-canvas.tsx`
- `src/components/evidence-trace/trace-inspector.tsx`
- `src/components/evidence-trace/trace-mobile.tsx`

### Verification

- `tests/engineering-timeline-model.node.test.ts`
- `tests/frontend-contract.node.test.ts`
- `scripts/frontend-static-audit.mjs`
- `scripts/frontend-syntax-check.cjs`

## Dependency changes

Phase D adds no new npm dependency. It builds on the existing Phase A+B+C dependency set.

## Verification evidence

The final dependency-free gate must be rerun immediately before packaging. The most recent pre-handoff run reported:

- 58 / 58 frontend contracts passed
- 21 / 21 model tests passed
- static accessibility/motion audit passed across 134 source files
- TypeScript/TSX syntax/transpile pass: 142 files, 0 syntax errors

The npm registry probe on 2026-09-04 failed with:

```text
EAI_AGAIN registry.npmjs.org
```

Therefore this environment cannot honestly claim these dependency-backed gates:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

Run them on a machine with working npm network before treating this checkpoint as production-build verified.

## Local migration from your current Phase C folder

Preserve the local database and env files. The PostgreSQL database lives outside the ZIP and should not be recreated.

Example:

```bash
cd ~/Documents
cp tracelab_frontend_build/.env /tmp/tracelab.env 2>/dev/null || true
cp tracelab_frontend_build/.env.local /tmp/tracelab.env.local 2>/dev/null || true
mv tracelab_frontend_build tracelab_frontend_build_phase_c
unzip TraceLab_Spatial_Workbench_Phase_D_Timeline_2026-09-04.zip
cp /tmp/tracelab.env tracelab_frontend_build/.env 2>/dev/null || true
cp /tmp/tracelab.env.local tracelab_frontend_build/.env.local 2>/dev/null || true
cd tracelab_frontend_build
npm install
npm run frontend:verify
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

Do not run `docker rm -v`, drop the PostgreSQL database, or reseed unless you intentionally want to replace local data.

## Routes to inspect first

```text
/app
/app/graph
/app/timeline
```

Useful focused-transition test:

1. Open `/app/graph`.
2. Select a source/test/decision.
3. Use `Timeline` in the Inspector.
4. Confirm Timeline opens the same evidence or its visible burst.
5. Use `Open in Trace` from Timeline Inspector.
6. Confirm Evidence Trace returns to the same real object after ELK settles.

## Next phase

Phase E should integrate Capture into the spatial operating surface without replacing the existing offline/domain pipeline:

- floating Capture launcher from Workbench
- compact type chooser
- photo/test/decision/rationale flows as overlays/sheets
- existing IndexedDB outbox remains authoritative for offline capture
- successful capture structurally appears in the Workbench/Timeline rather than relying on confetti/toast-only feedback
- mobile capture remains first-class
- post-save motion explains where the evidence entered the system
