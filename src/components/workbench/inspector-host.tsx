"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { panelTransition } from "@/components/spatial-motion/policy";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { getWorkboardPresentation } from "./workboard-content";
import { useWorkbenchStore } from "./store";
import type { WorkboardKind, WorkbenchSnapshot } from "./types";

const ROUTE_BY_BOARD: Record<WorkboardKind, string> = {
  "needs-context": "/app/inbox",
  "active-iteration": "/app/iterations",
  "recent-evidence": "/app/inbox?status=linked",
  "test-bench": "/app/tests",
  "decision-trail": "/app/decisions",
  "process-health": "/app/competition",
};

export function InspectorHost({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  const selectedId = useWorkbenchStore((state) => state.selectedId) as WorkboardKind | null;
  const dispatch = useWorkbenchStore((state) => state.dispatch);
  const reduceMotion = useReducedMotion();
  const presentation = selectedId ? getWorkboardPresentation(selectedId, snapshot) : null;

  return (
    <AnimatePresence initial={false}>
      {selectedId && presentation ? (
        <motion.aside
          key={selectedId}
          className="workbench-inspector workbench-inspector-dark h-full overflow-y-auto text-white"
          initial={reduceMotion ? false : { opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
          transition={panelTransition(Boolean(reduceMotion))}
          aria-label={`${presentation.title} inspector`}
        >
          <div className="workbench-inspector-header sticky top-0 z-10 flex items-center justify-between px-4 py-3">
            <div><div className="trace-meta text-[9px] uppercase text-white/34">Inspector</div><strong className="text-sm text-white/92">{presentation.title}</strong></div>
            <button type="button" className="grid h-9 w-9 place-items-center rounded-lg text-white/42 hover:bg-white/[0.06] hover:text-white" onClick={() => dispatch({ type: "set-inspector-open", open: false })} aria-label="Close inspector"><TraceIcon name="close" size={17} /></button>
          </div>
          <div className="space-y-5 p-4">
            <p className="text-sm leading-6 text-white/54">{presentation.summary}</p>
            <section className="workbench-inspector-evidence-surface rounded-[14px] p-3.5">
              <div className="trace-meta text-[9px] uppercase text-white/34">Current state</div>
              <dl className="mt-3 space-y-2.5 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-white/42">Missing context</dt><dd className="mono font-semibold text-white/86">{snapshot.counts.needsContext}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/42">Tests this week</dt><dd className="mono font-semibold text-white/86">{snapshot.counts.tests}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/42">Decisions this week</dt><dd className="mono font-semibold text-white/86">{snapshot.counts.decisions}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-white/42">Policy</dt><dd className="font-semibold text-white/86">{snapshot.policy.status.replace("_", " ")}</dd></div>
              </dl>
            </section>
            <Link href={ROUTE_BY_BOARD[selectedId]} className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-[#f5f6f2] px-3 text-xs font-semibold text-[#111315]">Open full view <span aria-hidden>↗</span></Link>
            <p className="text-[11px] leading-5 text-white/30">Presentation state only. Evidence relations, authorship and competition policy remain server-authoritative.</p>
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
