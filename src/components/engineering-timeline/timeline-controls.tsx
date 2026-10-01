"use client";

// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import type { TimelineScale } from "./types";

const SCALES: Array<{ value: TimelineScale; label: string }> = [
  { value: "month", label: "Month" },
  { value: "day", label: "Day" },
  { value: "detail", label: "Detail" },
];

export function TimelineControls({
  scale,
  onScaleChange,
  onFit,
  onLatest,
  onReplay,
  replaying,
  onHelp,
}: {
  scale: TimelineScale;
  onScaleChange: (scale: TimelineScale) => void;
  onFit: () => void;
  onLatest: () => void;
  onReplay: () => void;
  replaying: boolean;
  onHelp: () => void;
}) {
  return (
    <UiElement as="div" className="timeline-controls" aria-label="Timeline controls">
      <UiElement as="div" className="timeline-scale-switch" role="group" aria-label="Timeline density">
        {SCALES.map((item) => (
          <button key={item.value} type="button" data-active={scale === item.value ? "true" : "false"} onClick={() => onScaleChange(item.value)} aria-pressed={scale === item.value}>
            {item.label}
          </button>
        ))}
      </UiElement>
      <span className="timeline-control-divider" aria-hidden />
      <UiElement as="button" type="button" onClick={onReplay} className="timeline-replay-button" data-active={replaying ? "true" : "false"} aria-pressed={replaying} aria-label={replaying ? "Pause engineering trace replay" : "Replay engineering trace"}>
        <span aria-hidden><UiText text={replaying ? "Ⅱ" : "▶"} /></span> <UiText text={replaying ? "Pause" : "Replay"} />
      </UiElement>
      <button type="button" onClick={onFit}><UiText text="Fit history" /></button>
      <button type="button" onClick={onLatest}><UiText text="Latest" /></button>
      <UiElement as="button" type="button" onClick={onHelp} aria-label="Timeline shortcuts">?</UiElement>
    </UiElement>
  );
}
