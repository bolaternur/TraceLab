# Third-party source / pattern ledger

TraceLab owns its product-specific components and presentation. This ledger records external dependencies and studied interaction patterns so future contributors can distinguish dependency use from adapted design ideas.

## XYFlow / React Flow

- Source repo: `xyflow/xyflow`
- Source supplied by user: `xyflow-main.zip`
- License: MIT
- TraceLab use: npm dependency `@xyflow/react`; viewport, selection, custom node/edge, minimap and read-only canvas APIs.
- Adaptation policy: TraceLab components are original product-specific implementations. No wholesale source file copy.
- TraceLab destinations: `src/components/workbench/*`, `src/components/evidence-trace/*`.

## ELK.js

- Source package: Eclipse Layout Kernel JavaScript binding (`elkjs`)
- Version pinned for Phase C: `0.9.3`
- License: EPL-2.0 OR GPL-3.0-or-later (dependency use; preserve package license metadata/lockfile notices)
- TraceLab use: dependency-only layered graph placement for Evidence Trace.
- TraceLab destination: `src/components/evidence-trace/elk-layout.ts`.
- Fallback: TraceLab retains an original deterministic semantic layout in `layout.ts` so rendering/testing does not depend on ELK success.

## Activepieces

- Source supplied by user: `activepieces-main.zip`
- Relevant license scope studied: Community/non-EE MIT portions; EE code excluded.
- TraceLab use: interaction architecture reference only — separation of canvas state, selection and side inspection.
- No Activepieces source file copied.

## Excalidraw

- Source supplied by user: `excalidraw-master.zip`
- License: MIT
- TraceLab use: interaction reference for Space+drag, middle-mouse pan, viewport predictability and keyboard behavior.
- No Excalidraw source file copied.

## Langflow

- Source supplied by user: `langflow-main.zip`
- License: MIT
- TraceLab use: reference for async graph-layout lifecycle and keeping inspection UI outside the transformed canvas layer.
- No Langflow source file copied.
