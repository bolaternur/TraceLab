"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { getWorkboardPresentation, WorkboardContent } from "./workboard-content";
import { useWorkbenchSnapshot } from "./workbench-context";
import { useWorkbenchStore } from "./store";
import type { WorkboardKind } from "./types";

export interface WorkbenchNodeData extends Record<string, unknown> {
  kind: WorkboardKind;
}

export type WorkbenchFlowNode = Node<WorkbenchNodeData, "workboard">;

const ICON_BY_KIND: Record<WorkboardKind, string> = {
  "needs-context": "evidence",
  "active-iteration": "timeline",
  "recent-evidence": "photo",
  "test-bench": "test",
  "decision-trail": "decision",
  "process-health": "policy",
};

const TONE_BY_KIND: Record<WorkboardKind, string> = {
  "needs-context": "source",
  "active-iteration": "revision",
  "recent-evidence": "source",
  "test-bench": "test",
  "decision-trail": "decision",
  "process-health": "verified",
};

export function WorkboardNode({ data, selected }: NodeProps<WorkbenchFlowNode>) {
  const snapshot = useWorkbenchSnapshot();
  const recentlyUpdatedBoard = useWorkbenchStore((state) => state.recentlyUpdatedBoard);
  const presentation = getWorkboardPresentation(data.kind, snapshot);
  return (
    <article className="workbench-board flex h-full w-full flex-col" data-selected={selected ? "true" : "false"} data-recently-updated={recentlyUpdatedBoard === data.kind ? "true" : "false"} data-board-kind={data.kind} data-tone={TONE_BY_KIND[data.kind]}>
      <Handle type="target" position={Position.Left} className="workbench-handle" isConnectable={false} />
      <div className="workbench-artboard-header workbench-board-handle flex min-h-[66px] shrink-0 items-center gap-3 px-4 py-3.5">
        <span className="workbench-artboard-glyph grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-black/58"><TraceIcon name={ICON_BY_KIND[data.kind]} size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="workbench-artboard-label trace-meta text-[9px] uppercase text-black/40">{presentation.eyebrow}</div>
          <h2 className="mt-0.5 truncate text-[16px] font-semibold tracking-[-0.02em] text-[#111315]">{presentation.title}</h2>
        </div>
        {typeof presentation.count === "number" ? <span className="workbench-artboard-count mono text-[10px] text-black/42">{presentation.count}</span> : null}
      </div>
      <div className="nodrag nopan min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-1"><WorkboardContent kind={data.kind} snapshot={snapshot} /></div>
      <Handle type="source" position={Position.Right} className="workbench-handle" isConnectable={false} />
    </article>
  );
}
