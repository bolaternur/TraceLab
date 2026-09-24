import type { EvidenceTone } from "./presentation";
import type { TraceIconName } from "./trace-icon";

export type TimelineKind = "event" | "test" | "decision" | "iteration_open" | "iteration_close";
export type TimelineSourceTone = "neutral" | "success" | "danger" | "warning";

export interface TimelineVisual {
  label: string;
  icon: TraceIconName;
  tone: EvidenceTone;
  shape: "circle" | "square" | "diamond";
}

export function getTimelineVisual(kind: TimelineKind | string, sourceTone: TimelineSourceTone | string): TimelineVisual {
  if (kind === "test") {
    return {
      label: "Test",
      icon: "test",
      tone: sourceTone === "success" ? "verified" : sourceTone === "danger" ? "failure" : "test",
      shape: "diamond",
    };
  }
  if (kind === "decision") {
    return {
      label: "Decision",
      icon: "decision",
      tone: sourceTone === "danger" ? "failure" : "decision",
      shape: "diamond",
    };
  }
  if (kind === "iteration_open" || kind === "iteration_close") {
    return {
      label: kind === "iteration_open" ? "Iteration" : "Iteration closed",
      icon: "timeline",
      tone: sourceTone === "danger" ? "failure" : sourceTone === "success" ? "verified" : "revision",
      shape: "square",
    };
  }
  return {
    label: "Source event",
    icon: "evidence",
    tone: sourceTone === "warning" ? "pending" : sourceTone === "danger" ? "failure" : "source",
    shape: "circle",
  };
}
