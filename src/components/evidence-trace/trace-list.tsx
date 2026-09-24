"use client";

import Link from "next/link";
import { deepLinkForTraceNode } from "./model";
import { relationHumanLabel, relationStatusLabel, TRACE_KIND_META } from "./presentation";
import type { EvidenceTraceSnapshot } from "./types";

export function TraceList({ snapshot, selectedId, onSelect }: { snapshot: EvidenceTraceSnapshot; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  return (
    <section className="rounded-[20px] border border-border-subtle bg-surface p-4" aria-labelledby="trace-relation-explorer-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="trace-meta text-[9px] uppercase text-text-3">Accessible trace</p>
          <h2 id="trace-relation-explorer-title" className="mt-1 text-sm font-semibold text-ink">Relation explorer</h2>
        </div>
        <span className="mono text-[10px] text-text-3">{snapshot.nodes.length} objects · {snapshot.relations.length} relations</span>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border text-text-3">
              <th className="px-2 py-2 font-medium">From</th>
              <th className="px-2 py-2 font-medium">Relationship</th>
              <th className="px-2 py-2 font-medium">To</th>
              <th className="px-2 py-2 font-medium">Status</th>
              <th className="px-2 py-2 font-medium">Origin</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.relations.map((relation) => {
              const from = byId.get(relation.fromId);
              const to = byId.get(relation.toId);
              if (!from || !to) return null;
              const status = relationStatusLabel(relation);
              return (
                <tr key={relation.id} className={`border-b border-border/70 ${selectedId && relation.fromId !== selectedId && relation.toId !== selectedId ? "opacity-45" : ""}`}>
                  <td className="px-2 py-2.5">
                    <button type="button" onClick={() => onSelect?.(from.id)} className="text-left font-medium text-ink hover:underline">{from.label}</button>
                    <div className="mono mt-0.5 text-[9px] uppercase text-text-3">{TRACE_KIND_META[from.kind].label}</div>
                  </td>
                  <td className="px-2 py-2.5 font-medium text-text-2">{relationHumanLabel(relation)}</td>
                  <td className="px-2 py-2.5">
                    <button type="button" onClick={() => onSelect?.(to.id)} className="text-left font-medium text-ink hover:underline">{to.label}</button>
                    <div className="mono mt-0.5 text-[9px] uppercase text-text-3">{TRACE_KIND_META[to.kind].label}</div>
                  </td>
                  <td className="px-2 py-2.5"><span className={status === "Suggested" ? "badge badge-warning" : "badge"}>{status === "Suggested" ? "Suggested" : "Accepted"}</span></td>
                  <td className="mono px-2 py-2.5 text-[10px] text-text-3">{relation.origin}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {snapshot.relations.length === 0 ? <p className="mt-4 text-sm text-text-3">No explicit relations in this filtered trace.</p> : null}
      <div className="sr-only">
        {snapshot.nodes.map((node) => <Link key={node.id} href={deepLinkForTraceNode(node)}>{TRACE_KIND_META[node.kind].label}: {node.label}</Link>)}
      </div>
    </section>
  );
}
