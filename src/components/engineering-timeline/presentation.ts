import type { EngineeringTimelineEntry } from "./types";

export function timelineKindLabel(kind: EngineeringTimelineEntry["kind"]): string {
  if (kind === "test") return "Test";
  if (kind === "decision") return "Decision";
  if (kind === "iteration_open") return "Iteration opened";
  if (kind === "iteration_close") return "Iteration closed";
  return "Source event";
}

export function timelineDayKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

export function timelineDayLabel(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso)).toUpperCase();
}
