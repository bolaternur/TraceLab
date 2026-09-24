import type { WorkbenchEdgeModel, WorkbenchExtent, WorkbenchNodeModel, WorkbenchSnapshot, WorkboardKind } from "./types.ts";

export const WORKBENCH_LAYOUT_VERSION = 2;

const DEFAULT_BOARD_LAYOUT: Record<WorkboardKind, Omit<WorkbenchNodeModel, "id" | "kind">> = {
  "needs-context": { x: 0, y: 110, width: 410, height: 390 },
  "active-iteration": { x: 560, y: 40, width: 560, height: 560 },
  "recent-evidence": { x: 1250, y: 80, width: 460, height: 360 },
  "test-bench": { x: 260, y: 670, width: 430, height: 340 },
  "decision-trail": { x: 800, y: 720, width: 410, height: 310 },
  "process-health": { x: 1450, y: 580, width: 330, height: 270 },
};

const ORDER: WorkboardKind[] = [
  "needs-context",
  "active-iteration",
  "recent-evidence",
  "test-bench",
  "decision-trail",
  "process-health",
];

export function buildWorkbenchNodes(_snapshot: WorkbenchSnapshot): WorkbenchNodeModel[] {
  return ORDER.map((kind) => ({ id: kind, kind, ...DEFAULT_BOARD_LAYOUT[kind] }));
}

export function buildWorkbenchEdges(snapshot: WorkbenchSnapshot): WorkbenchEdgeModel[] {
  const edges: WorkbenchEdgeModel[] = [];
  if (snapshot.needsContext.length || snapshot.activeIterations.length) {
    edges.push({ id: "context-iteration", source: "needs-context", target: "active-iteration", relation: "context-to-iteration" });
  }
  if (snapshot.recentEvidence.length || snapshot.activeIterations.length) {
    edges.push({ id: "evidence-iteration", source: "recent-evidence", target: "active-iteration", relation: "evidence-to-iteration" });
  }
  if (snapshot.activeIterations.length || snapshot.counts.tests > 0) {
    edges.push({ id: "iteration-test", source: "active-iteration", target: "test-bench", relation: "iteration-to-test" });
  }
  if (snapshot.counts.tests > 0 || snapshot.counts.decisions > 0) {
    edges.push({ id: "test-decision", source: "test-bench", target: "decision-trail", relation: "test-to-decision" });
  }
  return edges;
}

export function getWorkbenchExtent(nodes: readonly WorkbenchNodeModel[], padding = 320): WorkbenchExtent {
  if (!nodes.length) return [[-padding, -padding], [padding, padding]];
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return [[minX - padding, minY - padding], [maxX + padding, maxY + padding]];
}

export function getLayoutStorageKey(teamId: string, seasonId: string | null): string {
  return `tracelab:workbench:${teamId}:${seasonId ?? "no-season"}:v${WORKBENCH_LAYOUT_VERSION}`;
}
