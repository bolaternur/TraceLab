"use client";

import { BaseEdge, getSmoothStepPath, type Edge, type EdgeProps } from "@xyflow/react";
import { useWorkbenchStore } from "./store";
import type { WorkbenchEdgeModel } from "./types";

interface TraceEdgeData extends Record<string, unknown> {
  relation: WorkbenchEdgeModel["relation"];
}

export type WorkbenchTraceEdge = Edge<TraceEdgeData, "trace">;

const ACTIVE_STROKE: Record<WorkbenchEdgeModel["relation"], string> = {
  "context-to-iteration": "#7f98ff",
  "evidence-to-iteration": "#7f98ff",
  "iteration-to-test": "#f5a63c",
  "test-to-decision": "#9b91ff",
};

export function TraceEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<WorkbenchTraceEdge>) {
  const selectedId = useWorkbenchStore((state) => state.selectedId);
  const active = selectedId === source || selectedId === target;
  const relation = data?.relation ?? "evidence-to-iteration";
  const stroke = active ? ACTIVE_STROKE[relation] : "rgba(245,246,242,.25)";
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 18,
    offset: 22,
  });

  return (
    <g className="workbench-trace-edge" data-active={active ? "true" : "false"}>
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke,
          strokeWidth: active ? 2 : 1.35,
          opacity: active ? 0.9 : 0.64,
          transition: "stroke 140ms ease, stroke-width 140ms ease, opacity 140ms ease",
        }}
      />
      <circle cx={labelX} cy={labelY} r={active ? 3 : 2.2} fill={stroke} opacity={active ? 0.9 : 0.52} aria-hidden />
    </g>
  );
}
