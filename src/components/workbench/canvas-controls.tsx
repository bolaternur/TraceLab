"use client";

import { useReactFlow } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { motionDuration } from "@/components/spatial-motion/policy";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { useWorkbenchStore } from "./store";

interface CanvasControlsProps {
  onResetLayout: () => void;
  onShowHelp: () => void;
}

export function CanvasControls({ onResetLayout, onShowHelp }: CanvasControlsProps) {
  const { fitView, zoomTo } = useReactFlow();
  const reduceMotion = useReducedMotion();
  const minimapOpen = useWorkbenchStore((state) => state.minimapOpen);
  const dispatch = useWorkbenchStore((state) => state.dispatch);

  return (
    <div className="workbench-canvas-controls workbench-chrome" aria-label="Canvas controls">
      <button type="button" onClick={() => void fitView({ padding: 0.14, duration: motionDuration("standard", Boolean(reduceMotion)) })} aria-label="Fit project" title="Fit project · F / 0">
        <span className="mono text-[10px]">FIT</span>
      </button>
      <button type="button" onClick={() => void zoomTo(1, { duration: motionDuration("standard", Boolean(reduceMotion)) })} aria-label="Zoom to 100 percent" title="100% · 1">
        <span className="mono text-[10px]">100</span>
      </button>
      <button type="button" onClick={() => dispatch({ type: "set-minimap-open", open: !minimapOpen })} aria-label={minimapOpen ? "Hide minimap" : "Show minimap"} title="Toggle minimap">
        <TraceIcon name="graph" size={16} />
      </button>
      <button type="button" onClick={onResetLayout} aria-label="Reset workboard layout" title="Reset workboard layout">
        <TraceIcon name="sync" size={16} />
      </button>
      <button type="button" onClick={onShowHelp} aria-label="Show canvas keyboard shortcuts" title="Keyboard help · ?">
        <span className="mono text-sm font-semibold">?</span>
      </button>
    </div>
  );
}
