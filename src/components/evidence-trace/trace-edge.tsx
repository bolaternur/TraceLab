"use client";

import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";
import { relationHumanLabel, relationStatusLabel } from "./presentation";
import type { EvidenceTraceRelation } from "./types";

export interface EvidenceTraceEdgeData extends Record<string, unknown> {
  relation: EvidenceTraceRelation;
  active: boolean;
  dimmed: boolean;
}

export type EvidenceTraceFlowEdge = Edge<EvidenceTraceEdgeData, "traceRelation">;

export function TraceRelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<EvidenceTraceFlowEdge>) {
  const relation = data?.relation;
  if (!relation) return null;
  const suggested = relation.status === "suggested";
  const active = Boolean(data?.active);
  const dimmed = Boolean(data?.dimmed);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 18,
    offset: 24,
  });
  const stroke = suggested ? "#d99023" : active ? "#7f98ff" : "rgba(231,234,228,.42)";

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: active ? 2 : 1.25,
          strokeDasharray: suggested ? "6 5" : undefined,
          opacity: dimmed ? 0.14 : active ? 0.95 : 0.58,
          transition: "stroke 140ms ease, opacity 140ms ease, stroke-width 140ms ease",
        }}
      />
      {(active || suggested) ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#242527]/95 px-2 py-1 text-[9px] font-semibold text-white/72 shadow-sm"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {suggested ? "Suggested · " : ""}{relationHumanLabel(relation)}
            <span className="sr-only"> · {relationStatusLabel(relation)}</span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
