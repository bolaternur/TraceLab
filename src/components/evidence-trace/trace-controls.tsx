"use client";

import { useReducedMotion } from "motion/react";
import { motionDuration } from "@/components/spatial-motion/policy";
import { useReactFlow } from "@xyflow/react";

export function TraceControls({ onHelp }: { onHelp: () => void }) {
  const { fitView, zoomTo } = useReactFlow();
  const reduceMotion = useReducedMotion();
  return (
    <div className="trace-canvas-controls" aria-label="Evidence Trace canvas controls">
      <button type="button" onClick={() => void fitView({ padding: 0.16, duration: motionDuration("standard", Boolean(reduceMotion)) })} aria-label="Fit evidence trace" title="Fit trace · F / 0"><span className="mono text-[10px]">FIT</span></button>
      <button type="button" onClick={() => void zoomTo(1, { duration: motionDuration("standard", Boolean(reduceMotion)) })} aria-label="Zoom evidence trace to 100 percent" title="100% · 1"><span className="mono text-[10px]">100</span></button>
      <button type="button" onClick={onHelp} aria-label="Show Evidence Trace keyboard shortcuts" title="Keyboard help · ?"><span className="mono text-sm font-semibold">?</span></button>
    </div>
  );
}
