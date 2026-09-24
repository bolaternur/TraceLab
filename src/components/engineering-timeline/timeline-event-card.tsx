"use client";

import Link from "next/link";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { formatTechnicalDate } from "@/components/tracelab/presentation";
import type { PositionedTimelineEntry } from "./types";

const KIND_META = {
  source_burst: { label: "Source burst", icon: "evidence" },
  event: { label: "Source event", icon: "evidence" },
  test: { label: "Test", icon: "test" },
  decision: { label: "Decision", icon: "decision" },
  iteration_open: { label: "Iteration", icon: "timeline" },
  iteration_close: { label: "Iteration closed", icon: "timeline" },
} as const;

export function TimelineEventCard({
  entry,
  selected,
  timeZone,
  onSelect,
}: {
  entry: PositionedTimelineEntry;
  selected: boolean;
  timeZone: string;
  onSelect: (id: string) => void;
}) {
  const meta = KIND_META[entry.kind];
  return (
    <article
      className="timeline-event-card"
      data-kind={entry.kind}
      data-tone={entry.tone}
      data-selected={selected ? "true" : "false"}
      style={{ left: entry.x, top: entry.y, width: entry.width, height: entry.height }}
      aria-label={`${meta.label}: ${entry.title}`}
    >
      <button
        type="button"
        className="timeline-event-select"
        aria-label="Select timeline event"
        aria-pressed={selected}
        onClick={() => onSelect(entry.id)}
      >
        <span className="timeline-event-icon" aria-hidden><TraceIcon name={meta.icon} size={14} /></span>
        <span className="min-w-0 flex-1 text-left">
          <span className="trace-meta block text-[8px] uppercase text-black/38">{meta.label}</span>
          <strong className="mt-0.5 block truncate text-[12px] font-semibold text-[#111315]">{entry.title}</strong>
        </span>
      </button>
      <div className="px-3 pb-2.5">
        <p className="line-clamp-2 min-h-[30px] text-[10px] leading-[15px] text-black/48">{entry.detail || "Recorded engineering evidence"}</p>
        <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-1.5">
          <span className="mono truncate text-[8px] uppercase text-black/36">{formatTechnicalDate(entry.occurredAt, timeZone)}</span>
          <Link href={entry.href} onClick={(event) => event.stopPropagation()} className="min-h-7 shrink-0 rounded-md px-1.5 py-1 text-[9px] font-semibold text-[#4169ff] hover:bg-[#4169ff]/[0.07]">
            {entry.memberIds.length > 1 ? `${entry.memberIds.length} records` : "Open"}
          </Link>
        </div>
      </div>
    </article>
  );
}
