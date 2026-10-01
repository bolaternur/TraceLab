"use client";

// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import type { WorkbenchSnapshot } from "./types";

export function WorkbenchTopBar({ snapshot, onCapture, canCapture }: { snapshot: WorkbenchSnapshot; onCapture: () => void; canCapture: boolean }) {
  return (
    <UiElement as="header" className="workbench-floating-chrome" aria-label="Workbench context">
      <div className="workbench-context-pill workbench-chrome">
        <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--signal-lime)]" aria-hidden />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <strong className="truncate text-[12px] font-semibold"><UiText text={snapshot.team.name} /><UiText text={snapshot.team.number ? ` · ${snapshot.team.number}` : ""} /></strong>
            <span className="hidden text-white/26 sm:inline" aria-hidden>·</span>
            <span className="hidden max-w-[220px] truncate text-[11px] text-white/52 sm:inline"><UiText text={snapshot.project.title ?? "Engineering evidence"} /></span>
          </div>
        </div>
      </div>

      <div className="workbench-action-cluster workbench-chrome">
        <div className="hidden items-center gap-1.5 xl:flex">
          <span className={`workbench-status-chip ${snapshot.policy.status === "clear" ? "is-clear" : "is-review"}`}><UiText text={snapshot.policy.status === "clear" ? "Policy clear" : "Policy review"} /></span>
          {snapshot.counts.needsContext > 0 ? <span className="workbench-status-chip"><UiText text={snapshot.counts.needsContext} /><UiText text="need why" /></span> : null}
        </div>
        <UiElement as="button" type="button" onClick={onCapture} disabled={!canCapture} className="workbench-top-action disabled:cursor-not-allowed disabled:opacity-45" aria-label={canCapture ? "Capture evidence" : "Capture unavailable for read-only role"} title={canCapture ? "Capture evidence" : "Student-authored capture is unavailable for this role"}><TraceIcon name="capture" size={15} /><UiText text="Capture" /></UiElement>
      </div>
    </UiElement>
  );
}
