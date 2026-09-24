import ELK, { type ElkNode } from "elkjs/lib/elk.bundled.js";
import type { EvidenceTraceLayout, EvidenceTraceSnapshot, PositionedEvidenceTraceNode } from "./types";
import { layoutEvidenceTrace } from "./layout";
import { visualRelationEndpoints } from "./model";

const elk = new ELK();
const NODE_WIDTH = 250;
const NODE_HEIGHT = 112;

export async function layoutEvidenceTraceWithElk(snapshot: EvidenceTraceSnapshot): Promise<EvidenceTraceLayout> {
  const fallback = layoutEvidenceTrace(snapshot);
  if (snapshot.nodes.length <= 1) return fallback;

  const graph: ElkNode = {
    id: "trace-root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": "46",
      "elk.layered.spacing.nodeNodeBetweenLayers": "92",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
      "elk.separateConnectedComponents": "true",
    },
    children: snapshot.nodes.map((node) => ({ id: node.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: snapshot.relations.map((relation, index) => {
      const endpoints = visualRelationEndpoints(snapshot, relation);
      return {
        id: relation.id || `trace-edge-${index}`,
        sources: [endpoints.source],
        targets: [endpoints.target],
      };
    }),
  };

  try {
    const result = await elk.layout(graph);
    const byId = new Map((result.children ?? []).map((child) => [child.id, child]));
    const nodes: PositionedEvidenceTraceNode[] = snapshot.nodes.map((node) => {
      const placed = byId.get(node.id);
      return {
        ...node,
        x: typeof placed?.x === "number" && Number.isFinite(placed.x) ? placed.x : fallback.nodes.find((candidate) => candidate.id === node.id)?.x ?? 0,
        y: typeof placed?.y === "number" && Number.isFinite(placed.y) ? placed.y : fallback.nodes.find((candidate) => candidate.id === node.id)?.y ?? 0,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    });
    const minX = Math.min(...nodes.map((node) => node.x));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxX = Math.max(...nodes.map((node) => node.x + node.width));
    const maxY = Math.max(...nodes.map((node) => node.y + node.height));
    return {
      nodes,
      relations: snapshot.relations,
      bounds: {
        minX,
        minY,
        maxX,
        maxY,
        width: Math.max(0, maxX - minX),
        height: Math.max(0, maxY - minY),
      },
    };
  } catch {
    return fallback;
  }
}
