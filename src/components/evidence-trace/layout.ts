import type {
  EvidenceTraceKind,
  EvidenceTraceLayout,
  EvidenceTraceSnapshot,
  PositionedEvidenceTraceNode,
} from "./types.ts";

const KIND_ORDER: EvidenceTraceKind[] = ["source_event", "iteration", "test", "decision"];
const COLUMN_X: Record<EvidenceTraceKind, number> = {
  source_event: 80,
  iteration: 430,
  test: 780,
  decision: 1130,
};
const NODE_WIDTH = 250;
const NODE_HEIGHT = 112;
const START_Y = 92;
const ROW_GAP = 46;
const WORLD_PADDING = 80;

function sortKey(node: EvidenceTraceSnapshot["nodes"][number]): string {
  return `${node.occurredAt ?? "9999"}|${node.label.toLocaleLowerCase()}|${node.id}`;
}

export function layoutEvidenceTrace(snapshot: EvidenceTraceSnapshot): EvidenceTraceLayout {
  const positioned: PositionedEvidenceTraceNode[] = [];

  for (const kind of KIND_ORDER) {
    const column = snapshot.nodes.filter((node) => node.kind === kind).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    column.forEach((node, index) => {
      positioned.push({
        ...node,
        x: COLUMN_X[kind],
        y: START_Y + index * (NODE_HEIGHT + ROW_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    });
  }

  positioned.sort((a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || a.y - b.y || a.id.localeCompare(b.id));

  if (positioned.length === 0) {
    return {
      nodes: [],
      relations: snapshot.relations,
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 },
    };
  }

  const minX = Math.min(...positioned.map((node) => node.x)) - WORLD_PADDING;
  const minY = Math.min(...positioned.map((node) => node.y)) - WORLD_PADDING;
  const maxX = Math.max(...positioned.map((node) => node.x + node.width)) + WORLD_PADDING;
  const maxY = Math.max(...positioned.map((node) => node.y + node.height)) + WORLD_PADDING;

  return {
    nodes: positioned,
    relations: snapshot.relations,
    bounds: { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY },
  };
}
