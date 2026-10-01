"use client";

// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { compactTraceDate, TRACE_KIND_META } from "./presentation";
import type { EvidenceTraceNode } from "./types";

export interface EvidenceTraceNodeData extends Record<string, unknown> {
  node: EvidenceTraceNode;
  dimmed: boolean;
}

export type EvidenceTraceFlowNode = Node<EvidenceTraceNodeData, "traceNode">;

const KIND_NAMES = {
  source_event: "Source event",
  iteration: "Iteration",
  test: "Test",
  decision: "Decision",
} as const;

export function TraceNode({ data, selected }: NodeProps<EvidenceTraceFlowNode>) {
  const node = data.node;
  const meta = TRACE_KIND_META[node.kind];
  const date = compactTraceDate(node.occurredAt);

  return (
    <UiElement as="article"
      className="trace-evidence-node h-full w-full overflow-hidden"
      data-kind={node.kind}
      data-tone={meta.tone}
      data-selected={selected ? "true" : "false"}
      data-dimmed={data.dimmed ? "true" : "false"}
      aria-label={`${KIND_NAMES[node.kind]}: ${node.label}`}
    >
      <Handle type="target" position={Position.Left} className="trace-node-handle" isConnectable={false} />
      <div className="flex h-full flex-col bg-surface text-ink">
        <div className="flex items-center gap-2.5 border-b border-black/8 px-3.5 py-2.5">
          <span className="flex-1" />
          {date ? <span className="mono shrink-0 text-[12px] text-text-2"><UiText text={date} /></span> : null}
        </div>
        <div className="flex min-h-0 flex-1 items-center px-3.5 py-3.5">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-[1.25] tracking-[-0.012em]"><UiText text={node.label} /></h3>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="trace-node-handle" isConnectable={false} />
    </UiElement>
  );
}
