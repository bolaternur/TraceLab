import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkbenchSnapshot, toIso } from "../src/components/workbench/snapshot.ts";
import { buildWorkbenchEdges, buildWorkbenchNodes, getWorkbenchExtent } from "../src/components/workbench/layout.ts";

const team = {
  id: "team-1",
  name: "Orion Robotics",
  number: "7419",
  program: "FTC",
  timezone: "Asia/Almaty",
};

const week = {
  needsContext: [
    {
      ev: {
        id: "e1",
        provider: "github",
        eventType: "commit",
        title: "Tune intake PID",
        occurredAt: new Date("2026-09-04T10:00:00Z"),
        status: "inbox",
        summary: null,
        subsystemId: "sub-1",
      },
      actor: "Anim",
      subsystem: "Intake",
    },
  ],
  recent: [
    {
      ev: {
        id: "e1",
        provider: "github",
        eventType: "commit",
        title: "Tune intake PID",
        occurredAt: new Date("2026-09-04T10:00:00Z"),
        status: "inbox",
        summary: null,
        subsystemId: "sub-1",
      },
      actor: "Anim",
    },
  ],
  activeIterations: [
    {
      it: {
        id: "it-1",
        title: "Intake roller redesign",
        state: "testing",
        openedAt: new Date("2026-09-03T08:00:00Z"),
        subsystemId: "sub-1",
      },
      subsystem: "Intake",
    },
  ],
  tests: 3,
  decisions: 2,
  inboxCount: 4,
  totalEvents: 12,
};

test("workbench snapshot normalizes real nested thisWeek rows into client-safe primitives", () => {
  const snapshot = buildWorkbenchSnapshot({
    team,
    season: { id: "season-1", year: 2026 },
    project: { id: "project-1", title: "Orion 2026" },
    policy: { status: "active", strict: true },
    week,
  });

  assert.equal(snapshot.team.name, "Orion Robotics");
  assert.equal(snapshot.project.id, "project-1");
  assert.equal(snapshot.needsContext[0].provider, "github");
  assert.equal(snapshot.needsContext[0].occurredAt, "2026-09-04T10:00:00.000Z");
  assert.equal(snapshot.recentEvidence[0].actor, "Anim");
  assert.equal(snapshot.activeIterations[0].openedAt, "2026-09-03T08:00:00.000Z");
  assert.deepEqual(snapshot.counts, { inbox: 4, tests: 3, decisions: 2, needsContext: 1 });
  assert.equal(snapshot.policy.status, "clear");
});

test("date normalization never calls getTime on absent or invalid values", () => {
  assert.equal(toIso(undefined), null);
  assert.equal(toIso(null), null);
  assert.equal(toIso("not-a-date"), null);
  assert.equal(toIso(new Date("2026-09-04T12:00:00Z")), "2026-09-04T12:00:00.000Z");
});

test("default workbench layout is stable, asymmetric, and bounded", () => {
  const snapshot = buildWorkbenchSnapshot({
    team,
    season: { id: "season-1", year: 2026 },
    project: { id: "project-1", title: "Orion 2026" },
    policy: { status: "needs_review", strict: false },
    week,
  });
  const nodes = buildWorkbenchNodes(snapshot);
  assert.deepEqual(nodes.map((node) => node.id), [
    "needs-context",
    "active-iteration",
    "recent-evidence",
    "test-bench",
    "decision-trail",
    "process-health",
  ]);
  assert.equal(new Set(nodes.map((node) => `${node.width}x${node.height}`)).size > 2, true);
  const extent = getWorkbenchExtent(nodes);
  assert.equal(extent.length, 2);
  assert.ok(extent[0][0] < 0);
  assert.ok(extent[1][0] > 1500);
  const edges = buildWorkbenchEdges(snapshot);
  assert.ok(edges.some((edge) => edge.source === "active-iteration" && edge.target === "test-bench"));
  assert.ok(edges.some((edge) => edge.source === "test-bench" && edge.target === "decision-trail"));
});

import {
  initialWorkbenchCanvasState,
  reduceWorkbenchCanvasState,
} from "../src/components/workbench/state.ts";

test("canvas state keeps selection, focus and escape semantics independent from evidence data", () => {
  const selected = reduceWorkbenchCanvasState(initialWorkbenchCanvasState, { type: "select", id: "test-bench" });
  assert.equal(selected.selectedId, "test-bench");
  assert.equal(selected.inspectorOpen, true);

  const viewport = { x: 120, y: 80, zoom: 0.8 };
  const focused = reduceWorkbenchCanvasState(selected, { type: "focus", id: "test-bench", viewport });
  assert.equal(focused.focusedId, "test-bench");
  assert.deepEqual(focused.lastViewport, viewport);

  const escapedFocus = reduceWorkbenchCanvasState(focused, { type: "escape" });
  assert.equal(escapedFocus.focusedId, null);
  assert.equal(escapedFocus.selectedId, "test-bench");
  assert.deepEqual(escapedFocus.restoreViewport, viewport);

  const escapedSelection = reduceWorkbenchCanvasState(escapedFocus, { type: "escape" });
  assert.equal(escapedSelection.selectedId, null);
  assert.equal(escapedSelection.inspectorOpen, false);
});

test("capture completion marks exactly one workboard as recently updated and can clear it", () => {
  const marked = reduceWorkbenchCanvasState(initialWorkbenchCanvasState, {
    type: "mark-recent-update",
    id: "test-bench",
  });
  assert.equal(marked.recentlyUpdatedBoard, "test-bench");

  const cleared = reduceWorkbenchCanvasState(marked, {
    type: "mark-recent-update",
    id: null,
  });
  assert.equal(cleared.recentlyUpdatedBoard, null);
});

test("visual QA composition makes active iteration the central hero artboard", () => {
  const snapshot = buildWorkbenchSnapshot({
    team,
    season: { id: "season-1", year: 2026 },
    project: { id: "project-1", title: "Orion 2026" },
    policy: { status: "active", strict: true },
    week,
  });
  const nodes = buildWorkbenchNodes(snapshot);
  const hero = nodes.find((node) => node.id === "active-iteration");
  assert.ok(hero);
  const others = nodes.filter((node) => node.id !== "active-iteration");
  assert.ok(others.every((node) => hero.width * hero.height > node.width * node.height));
  assert.ok(hero.x > 400 && hero.x < 800, "hero should occupy the visual center, not a left-column slot");
  assert.ok(hero.y >= 0 && hero.y <= 160);
  assert.ok(Math.max(...nodes.map((node) => node.x + node.width)) > 1750, "composition needs canvas breathing room");
});
