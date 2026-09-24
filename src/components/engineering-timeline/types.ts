export type EngineeringTimelineKind = "event" | "test" | "decision" | "iteration_open" | "iteration_close";
export type EngineeringTimelineTone = "neutral" | "success" | "danger" | "warning";
export type TimelineScale = "month" | "day" | "detail";

export interface EngineeringTimelineEntry {
  id: string;
  kind: EngineeringTimelineKind;
  title: string;
  detail: string;
  href: string;
  tone: EngineeringTimelineTone;
  occurredAt: string;
  iterationId: string | null;
  subsystemId: string | null;
  provider: string | null;
  eventType: string | null;
}

export interface EngineeringTimelineSnapshot {
  entries: EngineeringTimelineEntry[];
  timeZone: string;
  subsystemId: string | null;
}

export type TimelineDisplayKind = EngineeringTimelineKind | "source_burst";

export interface TimelineDisplayEntry {
  id: string;
  kind: TimelineDisplayKind;
  title: string;
  detail: string;
  href: string;
  tone: EngineeringTimelineTone;
  occurredAt: string;
  occurredEndAt: string;
  iterationId: string | null;
  subsystemId: string | null;
  provider: string | null;
  eventType: string | null;
  memberIds: string[];
  providers: string[];
}

export type TimelineLane = "source" | "iteration" | "test" | "decision";

export interface PositionedTimelineEntry extends TimelineDisplayEntry {
  lane: TimelineLane;
  x: number;
  y: number;
  width: number;
  height: number;
  track: number;
}

export interface TimelineTick {
  id: string;
  occurredAt: string;
  label: string;
  x: number;
}

export interface TimelineLaneLayout {
  lane: TimelineLane;
  label: string;
  y: number;
  height: number;
  tracks: number;
}

export interface TimelineIterationBand {
  id: string;
  iterationId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  memberIds: string[];
}

export interface EngineeringTimelineLayout {
  entries: PositionedTimelineEntry[];
  ticks: TimelineTick[];
  lanes: TimelineLaneLayout[];
  iterationBands: TimelineIterationBand[];
  width: number;
  height: number;
  startAt: string | null;
  endAt: string | null;
}
