"use client";

import Link from "next/link";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { deepLinkForTraceNode, whyLinkForTraceNode } from "./model";
import { compactTraceDate, nodeTechnicalLine, TRACE_KIND_META } from "./presentation";
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
  const provider = node.provider;
  const outcome = node.outcome;

  return (
    <article
      className="trace-evidence-node h-full w-full overflow-hidden"
      data-kind={node.kind}
      data-tone={meta.tone}
      data-selected={selected ? "true" : "false"}
      data-dimmed={data.dimmed ? "true" : "false"}
      aria-label={`${KIND_NAMES[node.kind]}: ${node.label}`}
    >
      <Handle type="target" position={Position.Left} className="trace-node-handle" isConnectable={false} />
      <div className="flex h-full flex-col bg-[#fbfbf8] text-[#111315]">
        <div className="flex items-center gap-2.5 border-b border-black/8 px-3.5 py-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-black/[0.045] text-black/55">
            <TraceIcon name={meta.icon} size={15} />
          </span>
          <span className="trace-meta min-w-0 flex-1 truncate text-[9px] uppercase text-black/42">{KIND_NAMES[node.kind]}</span>
          {date ? <span className="mono shrink-0 text-[9px] text-black/38">{date}</span> : null}
        </div>
        <div className="min-h-0 flex-1 px-3.5 py-3">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-[1.25] tracking-[-0.012em]">{node.label}</h3>
          <p className="mono mt-2 line-clamp-1 text-[9px] uppercase tracking-[0.05em] text-black/42">
            {provider ? `${provider} · ` : ""}{outcome ? `${outcome} · ` : ""}{nodeTechnicalLine(node)}
          </p>
        </div>
        <div className="nodrag nopan flex items-center gap-2 border-t border-black/8 px-3.5 py-2">
          <Link href={deepLinkForTraceNode(node)} className="text-[10px] font-semibold text-[#3156d9] hover:underline">Inspect</Link>
          <span aria-hidden className="text-black/18">/</span>
          <Link href={whyLinkForTraceNode(node)} className="text-[10px] font-semibold text-black/55 hover:text-black">Why?</Link>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="trace-node-handle" isConnectable={false} />
    </article>
  );
}
