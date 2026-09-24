import { buildTimelineDensity } from "./model.ts";
import type {
  EngineeringTimelineLayout,
  EngineeringTimelineSnapshot,
  PositionedTimelineEntry,
  TimelineDisplayEntry,
  TimelineIterationBand,
  TimelineLane,
  TimelineLaneLayout,
  TimelineScale,
  TimelineTick,
} from "./types.ts";

export const TIMELINE_CARD_WIDTH = 224;
export const TIMELINE_CARD_HEIGHT = 106;

const LEFT_GUTTER = 116;
const RIGHT_GUTTER = 72;
const TOP_AXIS = 72;
const LANE_HEADER = 30;
const TRACK_GAP = 18;
const LANE_GAP = 34;
const COLLISION_GAP = 22;

const SCALE_AXIS = {
  month: { pxPerDay: 72, min: 1400, max: 9000, tickMs: 30 * 24 * 60 * 60 * 1000 },
  day: { pxPerDay: 180, min: 1800, max: 14000, tickMs: 24 * 60 * 60 * 1000 },
  detail: { pxPerDay: 420, min: 2200, max: 22000, tickMs: 6 * 60 * 60 * 1000 },
} satisfies Record<TimelineScale, { pxPerDay: number; min: number; max: number; tickMs: number }>;

const LANE_ORDER: TimelineLane[] = ["source", "iteration", "test", "decision"];
const LANE_LABEL: Record<TimelineLane, string> = {
  source: "Source work",
  iteration: "Iterations",
  test: "Tests",
  decision: "Decisions",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function laneForTimelineEntry(entry: TimelineDisplayEntry): TimelineLane {
  if (entry.kind === "test") return "test";
  if (entry.kind === "decision") return "decision";
  if (entry.kind === "iteration_open" || entry.kind === "iteration_close") return "iteration";
  return "source";
}

function formatTick(date: Date, scale: TimelineScale, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", scale === "month"
    ? { month: "short", year: "2-digit", timeZone }
    : scale === "day"
      ? { day: "2-digit", month: "short", timeZone }
      : { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone }
  ).format(date).toUpperCase();
}

function buildTicks(input: {
  startMs: number;
  endMs: number;
  axisWidth: number;
  scale: TimelineScale;
  timeZone: string;
}): TimelineTick[] {
  const span = Math.max(1, input.endMs - input.startMs);
  const desired = SCALE_AXIS[input.scale].tickMs;
  const multiplier = Math.max(1, Math.ceil(span / desired / 64));
  const step = desired * multiplier;
  const first = Math.floor(input.startMs / step) * step;
  const ticks: TimelineTick[] = [];
  for (let time = first; time <= input.endMs + step && ticks.length < 80; time += step) {
    if (time < input.startMs - step * 0.25) continue;
    const ratio = (time - input.startMs) / span;
    const x = LEFT_GUTTER + clamp(ratio, 0, 1) * input.axisWidth;
    const date = new Date(time);
    ticks.push({ id: `${input.scale}:${time}`, occurredAt: date.toISOString(), label: formatTick(date, input.scale, input.timeZone), x });
  }
  return ticks;
}

function assignTracks(entries: Array<{ entry: TimelineDisplayEntry; x: number }>): Map<string, number> {
  const trackEnds: number[] = [];
  const tracks = new Map<string, number>();
  for (const { entry, x } of [...entries].sort((a, b) => a.x - b.x || a.entry.id.localeCompare(b.entry.id))) {
    let track = trackEnds.findIndex((end) => x >= end + COLLISION_GAP);
    if (track === -1) {
      track = trackEnds.length;
      trackEnds.push(x + TIMELINE_CARD_WIDTH);
    } else {
      trackEnds[track] = x + TIMELINE_CARD_WIDTH;
    }
    tracks.set(entry.id, track);
  }
  return tracks;
}

function buildIterationBands(positioned: PositionedTimelineEntry[]): TimelineIterationBand[] {
  const grouped = new Map<string, PositionedTimelineEntry[]>();
  for (const entry of positioned) {
    if (!entry.iterationId) continue;
    grouped.set(entry.iterationId, [...(grouped.get(entry.iterationId) ?? []), entry]);
  }
  const bands: TimelineIterationBand[] = [];
  for (const [iterationId, members] of grouped) {
    if (members.length < 2) continue;
    const minX = Math.min(...members.map((entry) => entry.x));
    const maxX = Math.max(...members.map((entry) => entry.x + entry.width));
    const minY = Math.min(...members.map((entry) => entry.y));
    const maxY = Math.max(...members.map((entry) => entry.y + entry.height));
    const title = members.find((entry) => entry.kind === "iteration_open")?.title
      ?? members.find((entry) => entry.kind === "iteration_close")?.title
      ?? `Iteration ${iterationId.slice(0, 8)}`;
    bands.push({
      id: `iteration-band:${iterationId}`,
      iterationId,
      title,
      x: Math.max(LEFT_GUTTER - 8, minX - 24),
      y: Math.max(TOP_AXIS + 6, minY - 18),
      width: maxX - minX + 48,
      height: maxY - minY + 36,
      memberIds: members.map((entry) => entry.id).sort(),
    });
  }
  return bands.sort((a, b) => a.x - b.x || a.iterationId.localeCompare(b.iterationId));
}

export function layoutEngineeringTimeline(
  snapshot: EngineeringTimelineSnapshot,
  scale: TimelineScale,
): EngineeringTimelineLayout {
  const display = buildTimelineDensity(snapshot, scale);
  if (display.length === 0) {
    const lanes = LANE_ORDER.map((lane, index): TimelineLaneLayout => ({ lane, label: LANE_LABEL[lane], y: TOP_AXIS + index * 150, height: 130, tracks: 1 }));
    return { entries: [], ticks: [], lanes, iterationBands: [], width: 1600, height: TOP_AXIS + lanes.length * 150 + 40, startAt: null, endAt: null };
  }

  const times = display.flatMap((entry) => [new Date(entry.occurredAt).getTime(), new Date(entry.occurredEndAt).getTime()]);
  const startMs = Math.min(...times);
  const endMs = Math.max(...times);
  const spanMs = Math.max(60 * 60 * 1000, endMs - startMs);
  const spanDays = spanMs / (24 * 60 * 60 * 1000);
  const geometry = SCALE_AXIS[scale];
  const axisWidth = clamp(spanDays * geometry.pxPerDay, geometry.min, geometry.max);
  const xFor = (iso: string) => LEFT_GUTTER + ((new Date(iso).getTime() - startMs) / spanMs) * axisWidth;

  const byLane = new Map<TimelineLane, Array<{ entry: TimelineDisplayEntry; x: number }>>();
  for (const entry of display) {
    const lane = laneForTimelineEntry(entry);
    byLane.set(lane, [...(byLane.get(lane) ?? []), { entry, x: xFor(entry.occurredAt) }]);
  }

  const laneLayouts: TimelineLaneLayout[] = [];
  const trackById = new Map<string, number>();
  let laneTop = TOP_AXIS;
  for (const lane of LANE_ORDER) {
    const laneEntries = byLane.get(lane) ?? [];
    const tracks = assignTracks(laneEntries);
    const trackCount = Math.max(1, ...laneEntries.map(({ entry }) => (tracks.get(entry.id) ?? 0) + 1));
    const height = LANE_HEADER + trackCount * (TIMELINE_CARD_HEIGHT + TRACK_GAP) - TRACK_GAP + 18;
    laneLayouts.push({ lane, label: LANE_LABEL[lane], y: laneTop, height, tracks: trackCount });
    for (const [id, track] of tracks) trackById.set(id, track);
    laneTop += height + LANE_GAP;
  }

  const laneByName = new Map(laneLayouts.map((lane) => [lane.lane, lane]));
  const positioned: PositionedTimelineEntry[] = display.map((entry) => {
    const lane = laneForTimelineEntry(entry);
    const laneLayout = laneByName.get(lane)!;
    const track = trackById.get(entry.id) ?? 0;
    return {
      ...entry,
      lane,
      track,
      x: xFor(entry.occurredAt),
      y: laneLayout.y + LANE_HEADER + track * (TIMELINE_CARD_HEIGHT + TRACK_GAP),
      width: TIMELINE_CARD_WIDTH,
      height: TIMELINE_CARD_HEIGHT,
    };
  }).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));

  const width = LEFT_GUTTER + axisWidth + TIMELINE_CARD_WIDTH + RIGHT_GUTTER;
  const height = laneTop + 24;
  return {
    entries: positioned,
    ticks: buildTicks({ startMs, endMs, axisWidth, scale, timeZone: snapshot.timeZone }),
    lanes: laneLayouts,
    iterationBands: buildIterationBands(positioned),
    width,
    height,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
  };
}
