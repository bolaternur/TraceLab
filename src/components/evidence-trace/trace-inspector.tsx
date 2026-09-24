"use client";

import Link from "next/link";
import { SpatialFadeSwap } from "@/components/spatial-motion/presence";
import { deepLinkForTraceNode, whyLinkForTraceNode } from "./model";
import { compactTraceDate, relationHumanLabel, relationStatusLabel, TRACE_KIND_META } from "./presentation";
import type { EvidenceTraceSnapshot } from "./types";

export function TraceInspector({ snapshot, selectedId, onSelect, onClose }: { snapshot: EvidenceTraceSnapshot; selectedId: string | null; onSelect: (id: string) => void; onClose: () => void }) {
  const selected = snapshot.nodes.find((node) => node.id === selectedId) ?? null;
  if (!selected) {
    return (
      <aside className="trace-inspector hidden min-w-0 md:flex" aria-live="polite">
        <div className="m-auto max-w-[240px] p-5 text-center">
          <p className="trace-meta text-[9px] uppercase text-white/35">Evidence inspector</p>
          <p className="mt-2 text-sm leading-6 text-white/58">Select an evidence object to inspect its first-order relations, provenance and deep links.</p>
        </div>
      </aside>
    );
  }

  const relations = snapshot.relations.filter((relation) => relation.fromId === selected.id || relation.toId === selected.id);
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const meta = TRACE_KIND_META[selected.kind];
  const timelineQuery = new URLSearchParams();
  if (selected.subsystemId) timelineQuery.set("subsystem", selected.subsystemId);
  timelineQuery.set("focus", selected.kind === "iteration" ? `${selected.id}-open` : selected.id);
  const timelineSearch = timelineQuery.toString();
  const timelineHref = `/app/timeline${timelineSearch ? `?${timelineSearch}` : ""}`;

  return (
    <aside className="trace-inspector hidden min-w-0 md:block" aria-live="polite" aria-label={`Evidence inspector: ${selected.label}`}>
      <SpatialFadeSwap motionKey={selected.id} className="h-full">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="min-w-0"><p className="trace-meta text-[9px] uppercase text-white/35">{meta.label}</p><h2 className="truncate text-sm font-semibold text-white">{selected.label}</h2></div>
        <button type="button" onClick={onClose} aria-label="Close evidence inspector" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/50 hover:bg-white/6 hover:text-white">×</button>
      </div>
      <div className="max-h-[calc(100dvh-190px)] overflow-y-auto p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
          <dt className="text-white/36">Recorded</dt><dd className="mono text-right text-white/62">{compactTraceDate(selected.occurredAt) ?? "—"}</dd>
          <dt className="text-white/36">Provider</dt><dd className="mono text-right text-white/62">{selected.provider ?? "—"}</dd>
          <dt className="text-white/36">Outcome</dt><dd className="mono text-right text-white/62">{selected.outcome ?? selected.detail ?? "—"}</dd>
        </dl>

        <div className="mt-5 border-t border-white/8 pt-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-white/80">First-order relations</h3><span className="mono text-[9px] text-white/35">{relations.length}</span></div>
          <ul className="mt-2 space-y-2">
            {relations.map((relation) => {
              const outbound = relation.fromId === selected.id;
              const other = byId.get(outbound ? relation.toId : relation.fromId);
              if (!other) return null;
              return (
                <li key={relation.id} className="rounded-[12px] border border-white/8 bg-white/[0.035] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold text-white/54">{outbound ? relationHumanLabel(relation) : `← ${relationHumanLabel(relation)}`}</span>
                    <span className={`mono text-[8px] uppercase ${relation.status === "suggested" ? "text-[#f5b85c]" : "text-white/32"}`}>{relationStatusLabel(relation)}</span>
                  </div>
                  <button type="button" onClick={() => onSelect(other.id)} className="mt-1.5 block w-full truncate text-left text-xs font-medium text-white/82 hover:text-white">{other.label}</button>
                  <p className="mono mt-1 text-[8px] uppercase text-white/28">{relation.origin} · {TRACE_KIND_META[other.kind].label}</p>
                </li>
              );
            })}
            {relations.length === 0 ? <li className="text-xs leading-5 text-white/38">No first-order relations in this filtered trace.</li> : null}
          </ul>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <Link href={deepLinkForTraceNode(selected)} className="grid min-h-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/74 hover:bg-white/[0.07]">Inspect</Link>
          <Link href={timelineHref} className="grid min-h-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/74 hover:bg-white/[0.07]">Timeline</Link>
          <Link href={whyLinkForTraceNode(selected)} className="grid min-h-10 place-items-center rounded-xl bg-[#dfe5ff] px-3 text-xs font-semibold text-[#1c316f] hover:bg-white">Why?</Link>
        </div>
      </div>
      </SpatialFadeSwap>
    </aside>
  );
}