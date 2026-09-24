"use client";

import Link from "next/link";
import { useState } from "react";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { SpatialBottomSheet } from "@/components/spatial-motion/presence";
import { getWorkboardPresentation, WorkboardContent } from "./workboard-content";
import type { WorkbenchSnapshot, WorkboardKind } from "./types";

const MOBILE_ORDER: WorkboardKind[] = ["active-iteration", "needs-context", "recent-evidence", "test-bench", "decision-trail", "process-health"];

const ROUTE_BY_BOARD: Record<WorkboardKind, string> = {
  "needs-context": "/app/inbox",
  "active-iteration": "/app/iterations",
  "recent-evidence": "/app/inbox?status=linked",
  "test-bench": "/app/tests",
  "decision-trail": "/app/decisions",
  "process-health": "/app/competition",
};

export function MobileWorkbench({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  const [inspectedKind, setInspectedKind] = useState<WorkboardKind | null>(null);
  const inspected = inspectedKind ? getWorkboardPresentation(inspectedKind, snapshot) : null;

  return (
    <div className="h-full overflow-y-auto bg-[#202124] pb-24 text-white md:hidden">
      <header className="px-4 pb-3 pt-4">
        <div className="trace-meta text-[9px] uppercase text-white/38">Spatial workbench</div>
        <div className="mt-1 flex items-end justify-between gap-3"><h1 className="min-w-0 truncate text-xl font-semibold">{snapshot.team.name}</h1><span className="mono shrink-0 text-[9px] uppercase text-white/30">Swipe →</span></div>
        <p className="mt-1 truncate text-xs text-white/44">{snapshot.project.title ?? "Engineering evidence"}{snapshot.project.seasonLabel ? ` · ${snapshot.project.seasonLabel}` : ""}</p>
      </header>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[7vw] pb-4" aria-label="Mobile workbench boards">
        {MOBILE_ORDER.map((kind) => {
          const presentation = getWorkboardPresentation(kind, snapshot);
          return (
            <article key={kind} className="workbench-board min-h-[56vh] w-[88vw] shrink-0 snap-center overflow-hidden">
              <div className="workbench-artboard-header flex min-h-[62px] items-center gap-2 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="trace-meta text-[9px] uppercase text-black/38">{presentation.eyebrow}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-[#111315]">{presentation.title}</h2>
                    {typeof presentation.count === "number" ? <span className="mono text-xs text-black/40">{presentation.count}</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-black/8 bg-black/[0.025] text-black/55 active:bg-black/[0.06]"
                  aria-label={`Inspect board: ${presentation.title}`}
                  title="Inspect board"
                  onClick={() => setInspectedKind(kind)}
                >
                  <TraceIcon name="search" size={17} />
                  <span className="sr-only">Inspect board</span>
                </button>
              </div>
              <div className="p-4 text-[#111315]"><WorkboardContent kind={kind} snapshot={snapshot} /></div>
            </article>
          );
        })}
      </div>

      <SpatialBottomSheet
        open={Boolean(inspectedKind && inspected)}
        onDismiss={() => setInspectedKind(null)}
        label="Mobile workbench inspector"
        panelClassName="workbench-mobile-inspector-dark overflow-hidden text-white"
      >
        {inspectedKind && inspected ? (<>
            <header className="flex min-h-14 items-center gap-3 border-b border-white/8 px-4">
              <div className="min-w-0 flex-1">
                <div className="trace-meta text-[9px] uppercase text-white/34">Mobile inspector</div>
                <strong className="block truncate text-sm text-white/92">{inspected.title}</strong>
              </div>
              <button type="button" className="grid h-11 w-11 place-items-center rounded-xl text-white/46 active:bg-white/[0.06]" aria-label="Close mobile inspector" onClick={() => setInspectedKind(null)}>
                <TraceIcon name="close" size={18} />
              </button>
            </header>
            <div className="space-y-4 p-4">
              <p className="text-sm leading-6 text-white/54">{inspected.summary}</p>
              <div className="workbench-mobile-inspector-note"><span className="trace-meta">Current lens</span><strong>{inspected.eyebrow}</strong><p>Open the canonical view for the complete evidence record and provenance.</p></div>
              <Link href={ROUTE_BY_BOARD[inspectedKind]} className="flex min-h-11 items-center justify-center rounded-xl bg-[#f5f6f2] px-4 text-sm font-semibold text-[#111315]">Open full view</Link>
            </div>
        </>) : null}
      </SpatialBottomSheet>
    </div>
  );
}
