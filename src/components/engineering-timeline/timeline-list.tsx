import Link from "next/link";
import { formatTechnicalDate } from "@/components/tracelab/presentation";
import { timelineKindLabel } from "./presentation";
import type { EngineeringTimelineSnapshot } from "./types";

export function TimelineList({ snapshot }: { snapshot: EngineeringTimelineSnapshot }) {
  return (
    <details className="hidden rounded-[18px] border border-border bg-surface md:block">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-blueprint">
        Chronological explorer
        <span className="ml-2 font-normal text-text-3">Recorded engineering history · {snapshot.entries.length} objects</span>
      </summary>
      <div className="border-t border-border-subtle p-4">
        <p className="mb-3 max-w-3xl text-xs leading-5 text-text-3">Recorded engineering history in a simple ordered representation. Use this when spatial positioning is not useful or when reviewing with assistive technology.</p>
        <ol className="space-y-2">
          {snapshot.entries.map((entry) => (
            <li key={entry.id} className="grid gap-2 rounded-[12px] border border-border-subtle bg-canvas p-3 sm:grid-cols-[130px_110px_1fr_auto] sm:items-center">
              <time className="mono text-[9px] uppercase text-text-3" dateTime={entry.occurredAt}>{formatTechnicalDate(entry.occurredAt, snapshot.timeZone)}</time>
              <span className="trace-meta text-[8px] uppercase text-text-3">{timelineKindLabel(entry.kind)}</span>
              <span className="min-w-0"><strong className="block truncate text-xs font-semibold text-ink">{entry.title}</strong><span className="mt-0.5 block truncate text-[11px] text-text-3">{entry.detail}</span></span>
              <Link href={entry.href} className="grid min-h-10 place-items-center rounded-lg px-2 text-xs font-semibold text-blueprint">Open</Link>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
