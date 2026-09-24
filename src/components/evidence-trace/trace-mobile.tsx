"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { deepLinkForTraceNode, whyLinkForTraceNode } from "./model";
import { relationHumanLabel, relationStatusLabel, TRACE_KIND_META } from "./presentation";
import { SpatialFadeSwap } from "../spatial-motion/presence";
import type { EvidenceTraceSnapshot } from "./types";

export function TraceMobile({ snapshot, initialSelectedId }: { snapshot: EvidenceTraceSnapshot; initialSelectedId: string | null }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? snapshot.nodes[0]?.id ?? null);
  const selected = snapshot.nodes.find((node) => node.id === selectedId) ?? snapshot.nodes[0] ?? null;
  const related = useMemo(() => selected ? snapshot.relations.filter((relation) => relation.fromId === selected.id || relation.toId === selected.id) : [], [selected, snapshot.relations]);
  const byId = useMemo(() => new Map(snapshot.nodes.map((node) => [node.id, node])), [snapshot.nodes]);

  if (!selected) return null;
  const timelineQuery = new URLSearchParams();
  if (selected.subsystemId) timelineQuery.set("subsystem", selected.subsystemId);
  timelineQuery.set("focus", selected.kind === "iteration" ? `${selected.id}-open` : selected.id);
  const timelineSearch = timelineQuery.toString();
  const timelineHref = `/app/timeline${timelineSearch ? `?${timelineSearch}` : ""}`;
  return (
    <section className="md:hidden" aria-label="Focused evidence trace">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="trace-meta text-[9px] uppercase text-text-3">Focused evidence trace</p>
          <h2 className="text-sm font-semibold">{TRACE_KIND_META[selected.kind].label}</h2>
        </div>
        <span className="mono text-[9px] text-text-3">{snapshot.nodes.findIndex((node) => node.id === selected.id) + 1}/{snapshot.nodes.length}</span>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3">
        {snapshot.nodes.map((node) => (
          <button
            type="button"
            key={node.id}
            onClick={() => setSelectedId(node.id)}
            className={`min-h-[132px] w-[82vw] max-w-[340px] shrink-0 snap-center rounded-[18px] border bg-surface p-4 text-left ${node.id === selected.id ? "border-blueprint shadow-sm" : "border-border"}`}
            aria-pressed={node.id === selected.id}
          >
            <span className="trace-meta text-[9px] uppercase text-text-3">{TRACE_KIND_META[node.kind].label}</span>
            <strong className="mt-2 block text-sm leading-5 text-ink">{node.label}</strong>
            <span className="mono mt-3 block text-[9px] uppercase text-text-3">{node.provider ?? node.outcome ?? node.detail ?? "Recorded evidence"}</span>
          </button>
        ))}
      </div>
      <SpatialFadeSwap motionKey={selected.id}>
        <div className="rounded-[20px] border border-border bg-surface p-4">
        <h3 className="text-sm font-semibold">First-order relations</h3>
        <ul className="mt-3 space-y-2">
          {related.map((relation) => {
            const otherId = relation.fromId === selected.id ? relation.toId : relation.fromId;
            const other = byId.get(otherId);
            if (!other) return null;
            return (
              <li key={relation.id} className="rounded-[14px] border border-border bg-canvas px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text-2">{relation.fromId === selected.id ? relationHumanLabel(relation) : `← ${relationHumanLabel(relation)}`}</span>
                  <span className="mono text-[9px] uppercase text-text-3">{relationStatusLabel(relation)}</span>
                </div>
                <button type="button" onClick={() => setSelectedId(other.id)} className="mt-1 text-left font-medium text-ink hover:underline">{other.label}</button>
              </li>
            );
          })}
          {related.length === 0 ? <li className="text-xs text-text-3">No first-order relations in this filtered trace.</li> : null}
        </ul>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Link href={deepLinkForTraceNode(selected)} className="trace-button min-h-11 rounded-full px-3 text-xs">Inspect</Link>
          <Link href={timelineHref} className="trace-button min-h-11 rounded-full px-3 text-xs">Timeline</Link>
          <Link href={whyLinkForTraceNode(selected)} className="trace-button trace-button-primary min-h-11 rounded-full px-3 text-xs">Why?</Link>
        </div>
        </div>
      </SpatialFadeSwap>
    </section>
  );
}
