import type {
  EngineeringTimelineEntry,
  EngineeringTimelineKind,
  EngineeringTimelineSnapshot,
  EngineeringTimelineTone,
} from "./types.ts";

const TIMELINE_KINDS = new Set<EngineeringTimelineKind>([
  "event",
  "test",
  "decision",
  "iteration_open",
  "iteration_close",
]);
const TIMELINE_TONES = new Set<EngineeringTimelineTone>(["neutral", "success", "danger", "warning"]);

export interface RawEngineeringTimelineItem {
  id?: unknown;
  at?: Date | string | null;
  kind?: unknown;
  title?: unknown;
  detail?: unknown;
  href?: unknown;
  tone?: unknown;
  iterationId?: unknown;
  subsystemId?: unknown;
  provider?: unknown;
  eventType?: unknown;
}

export function toTimelineIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (!(date instanceof Date)) return null;
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeTimelineEntry(raw: RawEngineeringTimelineItem): EngineeringTimelineEntry | null {
  if (
    typeof raw.id !== "string" ||
    !raw.id ||
    typeof raw.kind !== "string" ||
    !TIMELINE_KINDS.has(raw.kind as EngineeringTimelineKind) ||
    typeof raw.title !== "string" ||
    !raw.title ||
    typeof raw.href !== "string" ||
    !raw.href
  ) {
    return null;
  }
  const occurredAt = toTimelineIso(raw.at);
  if (!occurredAt) return null;
  const tone = typeof raw.tone === "string" && TIMELINE_TONES.has(raw.tone as EngineeringTimelineTone)
    ? raw.tone as EngineeringTimelineTone
    : "neutral";
  return {
    id: raw.id,
    kind: raw.kind as EngineeringTimelineKind,
    title: raw.title,
    detail: typeof raw.detail === "string" ? raw.detail : "",
    href: raw.href,
    tone,
    occurredAt,
    iterationId: nullableString(raw.iterationId),
    subsystemId: nullableString(raw.subsystemId),
    provider: nullableString(raw.provider),
    eventType: nullableString(raw.eventType),
  };
}

export function buildEngineeringTimelineSnapshot(input: {
  items: readonly RawEngineeringTimelineItem[];
  timeZone: string;
  subsystemId: string | null;
}): EngineeringTimelineSnapshot {
  const entries = input.items
    .map(normalizeTimelineEntry)
    .filter((entry): entry is EngineeringTimelineEntry => entry !== null)
    .sort((a, b) => {
      const dateDelta = a.occurredAt.localeCompare(b.occurredAt);
      return dateDelta || a.id.localeCompare(b.id);
    });
  return {
    entries,
    timeZone: input.timeZone || "UTC",
    subsystemId: input.subsystemId,
  };
}

import type { TimelineDisplayEntry, TimelineScale } from "./types.ts";

function localDayKey(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const byType = new Map(parts.map((part) => [part.type, part.value]));
  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function displayFromEntry(entry: EngineeringTimelineEntry): TimelineDisplayEntry {
  return {
    ...entry,
    occurredEndAt: entry.occurredAt,
    memberIds: [entry.id],
    providers: entry.provider ? [entry.provider] : [],
  };
}

function sourceBucketKey(entry: EngineeringTimelineEntry, scale: TimelineScale, timeZone: string): string {
  const day = localDayKey(entry.occurredAt, timeZone);
  const iteration = entry.iterationId ?? "unlinked";
  if (scale === "month") return `${iteration}|${day}`;
  const time = new Date(entry.occurredAt).getTime();
  const twoHours = 2 * 60 * 60 * 1000;
  return `${iteration}|${day}|${Math.floor(time / twoHours)}`;
}

function buildSourceBurst(entries: EngineeringTimelineEntry[]): TimelineDisplayEntry {
  const ordered = [...entries].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
  const providers = [...new Set(ordered.map((entry) => entry.provider).filter((provider): provider is string => Boolean(provider)))].sort();
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  return {
    id: `burst:${ordered.map((entry) => entry.id).join("+")}`,
    kind: "source_burst",
    title: `${ordered.length} source events`,
    detail: providers.length ? providers.join(" + ") : "Captured source activity",
    href: first.href,
    tone: ordered.some((entry) => entry.tone === "warning") ? "warning" : "neutral",
    occurredAt: first.occurredAt,
    occurredEndAt: last.occurredAt,
    iterationId: first.iterationId,
    subsystemId: first.subsystemId,
    provider: null,
    eventType: "burst",
    memberIds: ordered.map((entry) => entry.id),
    providers,
  };
}

export function buildTimelineDensity(snapshot: EngineeringTimelineSnapshot, scale: TimelineScale): TimelineDisplayEntry[] {
  if (scale === "detail") return snapshot.entries.map(displayFromEntry);

  const buckets = new Map<string, EngineeringTimelineEntry[]>();
  const passthrough: TimelineDisplayEntry[] = [];
  for (const entry of snapshot.entries) {
    if (entry.kind !== "event") {
      passthrough.push(displayFromEntry(entry));
      continue;
    }
    const key = sourceBucketKey(entry, scale, snapshot.timeZone);
    buckets.set(key, [...(buckets.get(key) ?? []), entry]);
  }

  const threshold = scale === "month" ? 2 : 3;
  for (const bucket of buckets.values()) {
    if (bucket.length >= threshold) passthrough.push(buildSourceBurst(bucket));
    else passthrough.push(...bucket.map(displayFromEntry));
  }

  return passthrough.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}

/** Resolve an authoritative evidence id to the visible display item at the current density. */
export function resolveTimelineDisplayId(entries: readonly TimelineDisplayEntry[], evidenceId: string): string | null {
  const direct = entries.find((entry) => entry.id === evidenceId);
  if (direct) return direct.id;
  return entries.find((entry) => entry.memberIds.includes(evidenceId))?.id ?? null;
}
