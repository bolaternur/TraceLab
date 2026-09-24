"use client";

import Link from "next/link";
import { SpatialFadeSwap } from "@/components/spatial-motion/presence";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { formatTechnicalDate } from "@/components/tracelab/presentation";
import type { EngineeringTimelineEntry, EngineeringTimelineSnapshot } from "./types";

type InspectedTimelineEntry = EngineeringTimelineEntry & { memberCount?: number; traceFocusId: string };

function traceFocusIdForEntry(entry: EngineeringTimelineEntry) {
  return entry.kind === "iteration_open" || entry.kind === "iteration_close" ? entry.iterationId ?? entry.id : entry.id;
}

function selectedEntry(snapshot: EngineeringTimelineSnapshot, selectedId: string | null): InspectedTimelineEntry | null {
  if (!selectedId) return null;
  const direct = snapshot.entries.find((entry) => entry.id === selectedId);
  if (direct) return { ...direct, traceFocusId: traceFocusIdForEntry(direct) };
  if (!selectedId.startsWith("burst:")) return null;
  const ids = selectedId.slice("burst:".length).split("+").filter(Boolean);
  const members = ids.map((id) => snapshot.entries.find((entry) => entry.id === id)).filter((entry): entry is EngineeringTimelineEntry => Boolean(entry));
  if (!members.length) return null;
  const first = members[0];
  const providers = [...new Set(members.map((entry) => entry.provider).filter(Boolean))].join(" + ");
  return {
    ...first,
    id: selectedId,
    title: `${members.length} source events`,
    detail: providers || first.detail,
    memberCount: members.length,
    traceFocusId: traceFocusIdForEntry(first),
  };
}

function kindLabel(kind: EngineeringTimelineEntry["kind"]) {
  if (kind === "test") return "Test";
  if (kind === "decision") return "Decision";
  if (kind === "iteration_open") return "Iteration opened";
  if (kind === "iteration_close") return "Iteration closed";
  return "Source event";
}

export function TimelineInspector({
  snapshot,
  selectedId,
  onClose,
}: {
  snapshot: EngineeringTimelineSnapshot;
  selectedId: string | null;
  onClose: () => void;
}) {
  const selected = selectedEntry(snapshot, selectedId);
  if (!selected) {
    return (
      <aside className="timeline-inspector hidden min-w-0 md:flex" aria-live="polite">
        <div className="m-auto max-w-[250px] p-5 text-center">
          <p className="trace-meta text-[9px] uppercase text-white/34">Engineering inspector</p>
          <p className="mt-2 text-sm leading-6 text-white/56">Select a source event, iteration, test or decision to inspect its recorded time context and open the underlying evidence.</p>
        </div>
      </aside>
    );
  }

  const iteration = selected.iterationId
    ? snapshot.entries.find((entry) => entry.iterationId === selected.iterationId && entry.kind === "iteration_open") ?? null
    : null;
  const traceQuery = new URLSearchParams();
  if (selected.subsystemId) traceQuery.set("subsystem", selected.subsystemId);
  traceQuery.set("focus", selected.traceFocusId);
  const traceSearch = traceQuery.toString();
  const traceHref = `/app/graph${traceSearch ? `?${traceSearch}` : ""}`;

  return (
    <aside className="timeline-inspector hidden min-w-0 md:block" aria-live="polite" aria-label={`Engineering inspector: ${selected.title}`}>
      <SpatialFadeSwap motionKey={selected.id} className="h-full">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="min-w-0">
          <p className="trace-meta text-[9px] uppercase text-white/34">Engineering inspector</p>
          <h2 className="truncate text-sm font-semibold text-white">{selected.title}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close timeline inspector" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/48 hover:bg-white/6 hover:text-white">
          <TraceIcon name="close" size={16} />
        </button>
      </div>
      <div className="max-h-[calc(100dvh-190px)] overflow-y-auto p-4">
        <div className="mb-4 inline-flex rounded-full border border-white/9 bg-white/[0.04] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-white/55">
          {selected.memberCount && selected.memberCount > 1 ? `Source burst · ${selected.memberCount} records` : kindLabel(selected.kind)}
        </div>
        <p className="text-sm leading-6 text-white/65">{selected.detail || "Recorded engineering evidence"}</p>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-white/8 pt-4 text-xs">
          <dt className="text-white/35">Recorded</dt><dd className="mono text-right text-white/64">{formatTechnicalDate(selected.occurredAt, snapshot.timeZone)}</dd>
          <dt className="text-white/35">Provider</dt><dd className="mono text-right text-white/64">{selected.provider ?? "—"}</dd>
          <dt className="text-white/35">Event type</dt><dd className="mono text-right text-white/64">{selected.eventType?.replaceAll("_", " ") ?? kindLabel(selected.kind)}</dd>
          <dt className="text-white/35">Subsystem</dt><dd className="mono truncate text-right text-white/64">{selected.subsystemId ?? "All / unassigned"}</dd>
        </dl>

        <section className="mt-5 border-t border-white/8 pt-4">
          <div className="trace-meta text-[9px] uppercase text-white/34">Iteration context</div>
          {iteration ? (
            <Link href={iteration.href} className="mt-2 block rounded-[12px] border border-white/8 bg-white/[0.035] p-3 hover:bg-white/[0.055]">
              <strong className="block truncate text-xs font-semibold text-white/82">{iteration.title}</strong>
              <span className="mono mt-1 block text-[8px] uppercase text-white/32">{selected.iterationId}</span>
            </Link>
          ) : (
            <p className="mt-2 text-xs leading-5 text-white/40">No iteration membership is stored for this timeline object.</p>
          )}
        </section>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Link href={selected.href} className="grid min-h-10 place-items-center rounded-xl border border-white/10 bg-white/[0.045] px-3 text-xs font-semibold text-white/74 hover:bg-white/[0.07]">Inspect</Link>
          <Link href={traceHref} className="grid min-h-10 place-items-center rounded-xl bg-[#dfe5ff] px-3 text-xs font-semibold text-[#1c316f] hover:bg-white">Open in Trace</Link>
        </div>
      </div>
      </SpatialFadeSwap>
    </aside>
  );
}