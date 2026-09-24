import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEngineeringTimelineSnapshot,
  toTimelineIso,
} from "../src/components/engineering-timeline/model.ts";

const raw = [
  {
    id: "src-1",
    at: new Date("2026-09-01T10:00:00Z"),
    kind: "event",
    title: "Commit: intake spacing",
    detail: "github · commit",
    href: "/app/inbox?event=src-1",
    tone: "neutral",
    iterationId: "it-1",
    subsystemId: "sub-intake",
    provider: "github",
    eventType: "commit",
  },
  {
    id: "test-1",
    at: "2026-09-02T12:00:00Z",
    kind: "test",
    title: "Jam recovery test",
    detail: "17/20 success",
    href: "/app/tests/test-1",
    tone: "success",
    iterationId: "it-1",
    subsystemId: "sub-intake",
    provider: null,
    eventType: null,
  },
];

test("timeline date normalization is safe for absent invalid Date and string values", () => {
  assert.equal(toTimelineIso(undefined), null);
  assert.equal(toTimelineIso(null), null);
  assert.equal(toTimelineIso("not-a-date"), null);
  assert.equal(toTimelineIso(new Date("2026-09-04T12:00:00Z")), "2026-09-04T12:00:00.000Z");
  assert.equal(toTimelineIso("2026-09-04T12:00:00Z"), "2026-09-04T12:00:00.000Z");
});

test("timeline snapshot is serializable chronological and preserves engineering metadata", () => {
  const snapshot = buildEngineeringTimelineSnapshot({
    items: [...raw].reverse(),
    timeZone: "Asia/Almaty",
    subsystemId: "sub-intake",
  });

  assert.equal(snapshot.entries.length, 2);
  assert.equal(snapshot.entries[0].id, "src-1");
  assert.equal(snapshot.entries[0].occurredAt, "2026-09-01T10:00:00.000Z");
  assert.equal(snapshot.entries[0].iterationId, "it-1");
  assert.equal(snapshot.entries[0].subsystemId, "sub-intake");
  assert.equal(snapshot.entries[0].provider, "github");
  assert.equal(snapshot.entries[0].eventType, "commit");
  assert.equal(snapshot.entries[0].href, "/app/inbox?event=src-1");
  assert.equal(snapshot.timeZone, "Asia/Almaty");
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
});

test("timeline snapshot rejects malformed rows instead of leaking invalid dates to the client", () => {
  const snapshot = buildEngineeringTimelineSnapshot({
    items: [
      ...raw,
      { id: "bad", at: undefined, kind: "event", title: "Broken", detail: "", href: "/bad", tone: "neutral" },
      { id: "bad-kind", at: "2026-09-03T00:00:00Z", kind: "mystery", title: "Mystery", detail: "", href: "/bad", tone: "neutral" },
    ],
    timeZone: "UTC",
    subsystemId: null,
  });
  assert.deepEqual(snapshot.entries.map((entry) => entry.id), ["src-1", "test-1"]);
});

import { buildTimelineDensity } from "../src/components/engineering-timeline/model.ts";

const denseRaw = [
  ...raw,
  { id: "src-2", at: "2026-09-01T10:30:00Z", kind: "event", title: "Push", detail: "github · push", href: "/app/inbox?event=src-2", tone: "neutral", iterationId: "it-1", subsystemId: "sub-intake", provider: "github", eventType: "push" },
  { id: "src-3", at: "2026-09-01T11:00:00Z", kind: "event", title: "CAD revision", detail: "onshape · cad_revision", href: "/app/inbox?event=src-3", tone: "neutral", iterationId: "it-1", subsystemId: "sub-intake", provider: "onshape", eventType: "cad_revision" },
  { id: "decision-1", at: "2026-09-02T13:00:00Z", kind: "decision", title: "Keep 36 mm", detail: "keep", href: "/app/decisions/decision-1", tone: "success", iterationId: "it-1", subsystemId: "sub-intake", provider: null, eventType: null },
  { id: "it-1-open", at: "2026-09-01T09:00:00Z", kind: "iteration_open", title: "Roller spacing", detail: "Iteration opened", href: "/app/iterations/it-1", tone: "neutral", iterationId: "it-1", subsystemId: "sub-intake", provider: null, eventType: null },
];

function denseSnapshot() {
  return buildEngineeringTimelineSnapshot({ items: denseRaw, timeZone: "UTC", subsystemId: "sub-intake" });
}

test("detail density preserves every authoritative timeline entry", () => {
  const snapshot = denseSnapshot();
  const display = buildTimelineDensity(snapshot, "detail");
  assert.equal(display.length, snapshot.entries.length);
  assert.ok(display.every((entry) => entry.kind !== "source_burst"));
});

test("day density collapses only a dense source burst and never tests decisions or iteration boundaries", () => {
  const display = buildTimelineDensity(denseSnapshot(), "day");
  const burst = display.find((entry) => entry.kind === "source_burst");
  assert.ok(burst);
  assert.equal(burst.memberIds.length, 3);
  assert.deepEqual(burst.providers.sort(), ["github", "onshape"]);
  assert.ok(display.some((entry) => entry.kind === "test"));
  assert.ok(display.some((entry) => entry.kind === "decision"));
  assert.ok(display.some((entry) => entry.kind === "iteration_open"));
});

test("month density is deterministic under reversed input and aggregates same-day source noise", () => {
  const a = denseSnapshot();
  const b = buildEngineeringTimelineSnapshot({ items: [...denseRaw].reverse(), timeZone: "UTC", subsystemId: "sub-intake" });
  const da = buildTimelineDensity(a, "month");
  const db = buildTimelineDensity(b, "month");
  assert.deepEqual(da, db);
  assert.equal(da.filter((entry) => entry.kind === "source_burst").length, 1);
});

import { layoutEngineeringTimeline } from "../src/components/engineering-timeline/layout.ts";

test("horizontal layout keeps semantic card size fixed while finer scale increases temporal distance", () => {
  const snapshot = denseSnapshot();
  const month = layoutEngineeringTimeline(snapshot, "month");
  const day = layoutEngineeringTimeline(snapshot, "day");
  const detail = layoutEngineeringTimeline(snapshot, "detail");
  const m0 = month.entries.find((entry) => entry.id === "it-1-open")!;
  const m1 = month.entries.find((entry) => entry.id === "decision-1")!;
  const d0 = day.entries.find((entry) => entry.id === "it-1-open")!;
  const d1 = day.entries.find((entry) => entry.id === "decision-1")!;
  const x0 = detail.entries.find((entry) => entry.id === "it-1-open")!;
  const x1 = detail.entries.find((entry) => entry.id === "decision-1")!;

  assert.equal(m0.width, d0.width);
  assert.equal(d0.width, x0.width);
  assert.equal(m0.height, d0.height);
  assert.ok(d1.x - d0.x > m1.x - m0.x);
  assert.ok(x1.x - x0.x > d1.x - d0.x);
});

test("layout is deterministic finite lane-aware and resolves collisions into tracks", () => {
  const snapshot = denseSnapshot();
  const a = layoutEngineeringTimeline(snapshot, "detail");
  const reversed = buildEngineeringTimelineSnapshot({ items: [...denseRaw].reverse(), timeZone: "UTC", subsystemId: "sub-intake" });
  const b = layoutEngineeringTimeline(reversed, "detail");
  assert.deepEqual(a.entries.map((entry) => [entry.id, entry.x, entry.y, entry.track]), b.entries.map((entry) => [entry.id, entry.x, entry.y, entry.track]));
  assert.ok(a.entries.every((entry) => Number.isFinite(entry.x) && Number.isFinite(entry.y)));
  assert.ok(a.width > 0 && a.height > 0);
  assert.ok(a.entries.some((entry) => entry.lane === "source"));
  assert.ok(a.entries.some((entry) => entry.lane === "iteration"));
  assert.ok(a.entries.some((entry) => entry.lane === "test"));
  assert.ok(a.entries.some((entry) => entry.lane === "decision"));
  const sources = a.entries.filter((entry) => entry.lane === "source");
  assert.ok(new Set(sources.map((entry) => entry.track)).size >= 2, "dense source events should use collision tracks");
});

test("iteration bands span only positioned members and retain the iteration title", () => {
  const layout = layoutEngineeringTimeline(denseSnapshot(), "day");
  const band = layout.iterationBands.find((candidate) => candidate.iterationId === "it-1");
  assert.ok(band);
  assert.equal(band.title, "Roller spacing");
  const members = layout.entries.filter((entry) => entry.iterationId === "it-1");
  const minX = Math.min(...members.map((entry) => entry.x));
  const maxX = Math.max(...members.map((entry) => entry.x + entry.width));
  assert.ok(band.x <= minX);
  assert.ok(band.x + band.width >= maxX);
});

import { resolveTimelineDisplayId } from "../src/components/engineering-timeline/model.ts";

test("deep-linked source evidence resolves to its visible burst without losing the authoritative evidence id", () => {
  const display = buildTimelineDensity(denseSnapshot(), "day");
  const burst = display.find((entry) => entry.kind === "source_burst")!;
  assert.equal(resolveTimelineDisplayId(display, "src-2"), burst.id);
  assert.equal(resolveTimelineDisplayId(display, "decision-1"), "decision-1");
  assert.equal(resolveTimelineDisplayId(display, "missing"), null);
});
