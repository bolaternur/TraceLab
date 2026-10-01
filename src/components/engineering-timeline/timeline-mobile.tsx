"use client";

// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { SpatialBottomSheet } from "@/components/spatial-motion/presence";
import { formatTechnicalDate } from "@/components/tracelab/presentation";
import { timelineDayKey, timelineDayLabel } from "./presentation";
import type { EngineeringTimelineEntry, EngineeringTimelineSnapshot } from "./types";

function groupByDay(snapshot: EngineeringTimelineSnapshot) {
  const groups = new Map<string, EngineeringTimelineEntry[]>();
  for (const entry of snapshot.entries) {
    const key = timelineDayKey(entry.occurredAt, snapshot.timeZone);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()];
}

export function TimelineMobile({ snapshot, initialSelectedId }: { snapshot: EngineeringTimelineSnapshot; initialSelectedId: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const groups = useMemo(() => groupByDay(snapshot), [snapshot]);
  const selected = snapshot.entries.find((entry) => entry.id === selectedId) ?? null;
  const traceQuery = new URLSearchParams();
  if (selected?.subsystemId) traceQuery.set("subsystem", selected.subsystemId);
  if (selected) traceQuery.set("focus", selected.kind.startsWith("iteration") ? selected.iterationId ?? selected.id : selected.id);
  const traceSearch = traceQuery.toString();
  const traceHref = `/app/graph${traceSearch ? `?${traceSearch}` : ""}`;

  return (
    <UiElement as="section" className="md:hidden space-y-5" aria-label="Mobile Engineering Timeline">
      {groups.map((entries) => (
        <section key={timelineDayKey(entries[0].occurredAt, snapshot.timeZone)} aria-labelledby={`timeline-day-${entries[0].id}`}>
          <h2 id={`timeline-day-${entries[0].id}`} className="trace-meta mb-2 text-[9px] uppercase text-text-3">
            {timelineDayLabel(entries[0].occurredAt, snapshot.timeZone)}
          </h2>
          <ol className="space-y-2 border-l border-border-strong pl-3">
            {entries.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[17px] top-4 h-2 w-2 rounded-full border border-border-strong bg-surface" aria-hidden />
                <article className="rounded-[16px] border border-border bg-surface p-3 shadow-[0_6px_18px_rgba(17,19,21,.04)]">
                  <UiElement as="button" type="button" className="flex min-h-11 w-full items-start gap-3 text-left" aria-label="Inspect timeline event" onClick={() => setSelectedId(entry.id)}>
                    <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-border bg-canvas text-text-2" aria-hidden>
                      <TraceIcon name={entry.kind === "test" ? "test" : entry.kind === "decision" ? "decision" : entry.kind.startsWith("iteration") ? "timeline" : "evidence"} size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="mt-0.5 block text-sm font-semibold text-ink"><UiText text={entry.title} /></strong>
                      <span className="mt-1 line-clamp-2 block text-xs leading-5 text-text-2">{entry.kind === "event" ? null : <UiText text={entry.detail} />}</span>
                    </span>
                  </UiElement>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-border-subtle pt-2">
                    <span className="mono text-[9px] uppercase text-text-3">{formatTechnicalDate(entry.occurredAt, snapshot.timeZone)}</span>
                    <Link href={entry.href} className="grid min-h-11 place-items-center rounded-lg px-2 text-xs font-semibold text-blueprint"><UiText text="Open" /></Link>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}

      <SpatialBottomSheet open={Boolean(selected)} onDismiss={() => setSelectedId(null)} label="Mobile timeline inspector" panelClassName="p-4">
        {selected ? (<>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Mobile timeline inspector" /></p>
                <h2 className="mt-1 text-lg font-semibold tracking-[-.02em] text-ink">{selected.title}</h2>
              </div>
              <UiElement as="button" type="button" className="grid min-h-11 min-w-11 place-items-center rounded-xl text-text-2 hover:bg-canvas" aria-label="Close mobile timeline inspector" onClick={() => setSelectedId(null)}><TraceIcon name="close" size={17} /></UiElement>
            </div>
            <p className="mt-3 text-sm leading-6 text-text-2">{selected.detail || "Recorded engineering evidence"}</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-border-subtle pt-3 text-xs">
              <dt className="text-text-3"><UiText text="Recorded" /></dt><dd className="mono text-right text-text-2">{formatTechnicalDate(selected.occurredAt, snapshot.timeZone)}</dd>
              <dt className="text-text-3"><UiText text="Provider" /></dt><dd className="mono text-right text-text-2">{selected.provider ?? "—"}</dd>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href={selected.href} className="grid min-h-11 place-items-center rounded-xl border border-border bg-canvas px-3 text-xs font-semibold text-ink"><UiText text="Inspect" /></Link>
              <Link href={traceHref} className="grid min-h-11 place-items-center rounded-xl bg-ink px-3 text-xs font-semibold text-white"><UiText text="Open in Trace" /></Link>
            </div>
        </>) : null}
      </SpatialBottomSheet>
    </UiElement>
  );
}
