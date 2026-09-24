# Spatial Workbench Reference Matrix

This matrix records the concrete mechanics studied from the user-supplied reference repositories. It is an implementation aid, not permission to copy unrelated code.

| Need in TraceLab | Primary reference | Exact inspected path | Mechanic to adapt | TraceLab decision |
|---|---|---|---|---|
| Figma-like canvas input | XYFlow | `examples/react/src/examples/Figma/index.tsx` | `selectionOnDrag`, partial selection, `panOnDrag={[1,2]}`, `panOnScroll`, modifier zoom | Use as base interaction model, adjusted for Space+drag |
| Viewport engine | XYFlow | `packages/react/src/` | ReactFlow controlled nodes/edges, viewport, custom nodes/edges | Core canvas engine |
| Dotted background | XYFlow + Activepieces | XYFlow Background; AP `flow-canvas/index.tsx` | Dots rendered as canvas background primitive | Graphite background + restrained white dots |
| Separate canvas state | Activepieces | `packages/web/src/app/builder/state/canvas-state.ts` | selection, panning mode, minimap, sidebar stored independently | Small TraceLab Zustand presentation store |
| Bounded “infinite” canvas | Activepieces | `flow-canvas/index.tsx` | `translateExtent` from content bounds plus viewport padding | Keep users spatially oriented |
| Canvas controls | Activepieces | `flow-canvas/canvas-controls/index.tsx` | immediate zoom, fit view, hand/select modes, minimap toggle | Compact floating lower-left controls |
| Minimap | Activepieces | `flow-canvas/widgets/minimap.tsx` | optional, pannable, zoomable minimap | Optional desktop minimap, hidden by default on small laptop/tablet |
| Inspector separation | Activepieces | `step-data/step-data-panel-host.tsx` | data/detail panel outside canvas transform; drawer/split modes | Shared resizable InspectorHost |
| Space/middle pan behavior | Excalidraw | `packages/excalidraw/components/App.tsx` | Space+primary drag and middle-mouse pan | Required direct-manipulation behavior |
| Interaction regression discipline | Excalidraw | `tests/interactivity.test.tsx`, `tests/scrollConstraints.test.tsx` | dedicated wheel/zoom/pan tests | Playwright/component tests for canvas input |
| Fit-view lifecycle | Langflow | `src/frontend/src/stores/flowStore.ts` + related tests | defer fit until measured nodes exist; explicit fit request state | Never use arbitrary timeouts for initial fit |
| Canvas-control accessibility | Langflow | `components/core/canvasControlsComponent/__tests__` | a11y tests for toolbar/controls | Required labels, keyboard and reduced-motion tests |
| Fine graph auto-layout | TraceLab + ELK plan | current `src/server/evidence.ts::evidenceGraph` | server already emits domain nodes/edges | Use ELK only in `/app/graph`, not home workboards |
| Home semantic data | TraceLab | `src/server/evidence.ts::thisWeek` | needsContext/recent/active iterations/test and decision counts | Adapt into serializable WorkbenchSnapshot |
| Canonical relation data | TraceLab | `src/server/evidence.ts::evidenceGraph` | accepted/suggested relations + FK-derived structural edges | Never invent home/trace causal edges |

## License guardrails

- XYFlow: MIT.
- Excalidraw: MIT.
- Langflow: MIT.
- Activepieces root license: inspected non-EE builder paths are MIT Expat; listed EE paths have separate licensing. Do not copy from EE paths.
- Prefer public API usage and independent implementation of observed mechanics.

## Anti-copy rules

Do not copy:

- Activepieces purple branding or workflow-node appearance.
- Langflow AI-builder visual language.
- Excalidraw hand-drawn visual styling.
- n8n node appearance or arbitrary workflow editing semantics.
- reference repo product copy.

TraceLab identity remains: graphite engineering world + light evidence workboards + restrained Trace relationships + explicit provenance.
