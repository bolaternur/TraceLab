"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { isEditableSpatialTarget } from "@/components/spatial-motion/input";
import { layoutEngineeringTimeline } from "./layout";
import { resolveTimelineDisplayId } from "./model";
import { TimelineControls } from "./timeline-controls";
import { TimelineEventCard } from "./timeline-event-card";
import type { EngineeringTimelineSnapshot, TimelineScale } from "./types";


export function TimelineSurface({
  snapshot,
  initialScale,
  selectedId,
  initialFocusId,
  onSelect,
}: {
  snapshot: EngineeringTimelineSnapshot;
  initialScale: TimelineScale;
  selectedId: string | null;
  initialFocusId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [scale, setScale] = useState<TimelineScale>(initialScale);
  const [helpOpen, setHelpOpen] = useState(false);
  const [replayCursor, setReplayCursor] = useState<number | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const initialFocusConsumed = useRef(false);
  const reduceMotion = useReducedMotion();
  const layout = useMemo(() => layoutEngineeringTimeline(snapshot, scale), [scale, snapshot]);

  const focusEntry = useCallback((id: string) => {
    const displayId = resolveTimelineDisplayId(layout.entries, id);
    const entry = displayId ? layout.entries.find((candidate) => candidate.id === displayId) : null;
    const scroller = scrollerRef.current;
    if (!entry || !scroller) return;
    const target = Math.max(0, entry.x - scroller.clientWidth / 2 + entry.width / 2);
    scroller.scrollTo({ left: target, behavior: reduceMotion ? "auto" : "smooth" });
  }, [layout.entries, reduceMotion]);

  useEffect(() => {
    if (!initialFocusId || initialFocusConsumed.current) return;
    if (!resolveTimelineDisplayId(layout.entries, initialFocusId)) return;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        focusEntry(initialFocusId);
        initialFocusConsumed.current = true;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusEntry, initialFocusId, layout.entries]);

  const fitHistory = useCallback(() => {
    setScale("month");
    requestAnimationFrame(() => scrollerRef.current?.scrollTo({ left: 0, behavior: reduceMotion ? "auto" : "smooth" }));
  }, [reduceMotion]);

  const latest = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTo({ left: scroller.scrollWidth, behavior: reduceMotion ? "auto" : "smooth" });
  }, [reduceMotion]);

  const toggleReplay = useCallback(() => {
    if (!layout.entries.length) return;
    if (replayCursor !== null) {
      setReplayCursor(null);
      return;
    }
    const selectedDisplayId = selectedId ? resolveTimelineDisplayId(layout.entries, selectedId) : null;
    const selectedIndex = selectedDisplayId ? layout.entries.findIndex((entry) => entry.id === selectedDisplayId) : -1;
    setReplayCursor(selectedIndex >= 0 && selectedIndex < layout.entries.length - 1 ? selectedIndex : 0);
  }, [layout.entries, replayCursor, selectedId]);

  useEffect(() => {
    if (replayCursor === null) return;
    const entry = layout.entries[replayCursor];
    if (!entry) {
      const timer = window.setTimeout(() => setReplayCursor(null), 0);
      return () => window.clearTimeout(timer);
    }
    onSelect(entry.id);
    focusEntry(entry.id);
    const timer = window.setTimeout(() => {
      setReplayCursor((cursor) => {
        if (cursor === null || cursor >= layout.entries.length - 1) return null;
        return cursor + 1;
      });
    }, reduceMotion ? 900 : 1250);
    return () => window.clearTimeout(timer);
  }, [focusEntry, layout.entries, onSelect, reduceMotion, replayCursor]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isEditableSpatialTarget(event.target)) return;
      if (event.key === "?" && !event.ctrlKey && !event.metaKey) { event.preventDefault(); setHelpOpen(true); return; }
      if (event.key === "f" || event.key === "F" || event.key === "0") { event.preventDefault(); fitHistory(); return; }
      if (event.key === "Escape") { event.preventDefault(); setHelpOpen(false); onSelect(null); return; }
      if (event.key === "Enter" && selectedId) { event.preventDefault(); focusEntry(selectedId); return; }
      if (event.key === "r" || event.key === "R") { event.preventDefault(); toggleReplay(); return; }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        scrollerRef.current?.scrollBy({ left: event.key === "ArrowLeft" ? -260 : 260, behavior: reduceMotion ? "auto" : "smooth" });
        return;
      }
      if ((event.key === "ArrowUp" || event.key === "ArrowDown") && layout.entries.length) {
        event.preventDefault();
        const selectedDisplayId = selectedId ? resolveTimelineDisplayId(layout.entries, selectedId) : null;
        const current = selectedDisplayId ? layout.entries.findIndex((entry) => entry.id === selectedDisplayId) : -1;
        const delta = event.key === "ArrowDown" ? 1 : -1;
        const nextIndex = Math.min(layout.entries.length - 1, Math.max(0, current < 0 ? 0 : current + delta));
        const next = layout.entries[nextIndex];
        onSelect(next.id);
        focusEntry(next.id);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [fitHistory, focusEntry, layout.entries, onSelect, reduceMotion, selectedId, toggleReplay]);

  return (
    <section className="relative hidden min-h-[560px] overflow-hidden bg-[#202124] md:block" aria-label="Spatial Engineering Timeline">
      <div ref={scrollerRef} className="timeline-spatial-surface h-[min(68vh,760px)] min-h-[560px] overflow-x-auto overflow-y-auto" tabIndex={0}>
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <div className="timeline-axis" aria-hidden>
            {layout.ticks.map((tick) => (
              <div key={tick.id} className="timeline-tick" style={{ left: tick.x }}>
                <span>{tick.label}</span>
              </div>
            ))}
          </div>

          {layout.lanes.map((lane) => (
            <div key={lane.lane} className="timeline-lane" data-lane={lane.lane} style={{ top: lane.y, height: lane.height }} aria-hidden>
              <span className="timeline-lane-label">{lane.label}</span>
            </div>
          ))}

          {layout.iterationBands.map((band) => (
            <div key={band.id} className="timeline-iteration-band" style={{ left: band.x, top: band.y, width: band.width, height: band.height }} aria-hidden>
              <span>{band.title}</span>
            </div>
          ))}

          {layout.entries.map((entry) => (
            <TimelineEventCard key={entry.id} entry={entry} selected={selectedId === entry.id || Boolean(selectedId && entry.memberIds.includes(selectedId))} timeZone={snapshot.timeZone} onSelect={onSelect} />
          ))}
        </div>
      </div>

      <TimelineControls scale={scale} onScaleChange={(nextScale) => { setReplayCursor(null); setScale(nextScale); }} onFit={fitHistory} onLatest={latest} onReplay={toggleReplay} replaying={replayCursor !== null} onHelp={() => setHelpOpen(true)} />

      {replayCursor !== null ? (
        <div className="timeline-replay-status" role="status" aria-live="polite">
          <span className="timeline-replay-dot" aria-hidden />
          Trace Replay · {replayCursor + 1}/{layout.entries.length}
        </div>
      ) : null}

      {helpOpen ? (
        <div className="timeline-shortcut-help" role="dialog" aria-label="Timeline shortcuts">
          <div className="flex items-center justify-between gap-4">
            <strong className="text-sm text-white">Timeline shortcuts</strong>
            <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close Timeline shortcuts">×</button>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs text-white/60">
            <dt className="mono text-white">← / →</dt><dd>Move through time</dd>
            <dt className="mono text-white">↑ / ↓</dt><dd>Select previous / next evidence</dd>
            <dt className="mono text-white">Enter</dt><dd>Focus selected evidence</dd>
            <dt className="mono text-white">R</dt><dd>Play / pause Trace Replay</dd>
            <dt className="mono text-white">F / 0</dt><dd>Fit full history</dd>
            <dt className="mono text-white">Esc</dt><dd>Clear focus</dd>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
