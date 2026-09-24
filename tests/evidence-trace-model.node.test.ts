import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEvidenceTraceSnapshot,
  deepLinkForTraceNode,
  firstOrderNeighborhood,
  toTraceIso,
  visualRelationEndpoints,
} from "../src/components/evidence-trace/model.ts";
import { layoutEvidenceTrace } from "../src/components/evidence-trace/layout.ts";

const rawNodes = [
  {
    id: "src-1",
    type: "source_event",
    label: "Tune intake PID",
    sublabel: "github · commit",
    date: new Date("2026-09-01T10:00:00Z"),
    subsystemId: "sub-1",
    outcome: null,
  },
  {
    id: "it-1",
    type: "iteration",
    label: "Intake roller redesign",
    sublabel: "testing",
    date: "2026-09-02T10:00:00.000Z",
    subsystemId: "sub-1",
    outcome: null,
  },
  {
    id: "test-1",
    type: "test",
    label: "Compression test",
    sublabel: "8 / 10",
    date: new Date("2026-09-03T10:00:00Z"),
    subsystemId: "sub-1",
    outcome: "pass",
  },
  {
    id: "decision-1",
    type: "decision",
    label: "Keep revision B",
    sublabel: "keep",
    date: new Date("2026-09-04T10:00:00Z"),
    subsystemId: "sub-1",
    outcome: "keep",
  },
] as const;

const rawEdges = [
  { id: "r1", from: "src-1", to: "it-1", type: "SUPPORTS", origin: "student", status: "accepted" },
  { id: "r2", from: "it-1", to: "test-1", type: "TESTS", origin: "system", status: "accepted" },
  { id: "r3", from: "test-1", to: "decision-1", type: "SUPPORTS", origin: "student", status: "accepted" },
  { id: "r4", from: "test-1", to: "decision-1", type: "SUPPORTS", origin: "student", status: "accepted" },
  { id: "r5", from: "it-1", to: "decision-1", type: "RELATED_TO", origin: "suggestion", status: "suggested" },
] as const;

test("trace date normalization is safe for absent, invalid, Date and string values", () => {
  assert.equal(toTraceIso(undefined), null);
  assert.equal(toTraceIso(null), null);
  assert.equal(toTraceIso("not-a-date"), null);
  assert.equal(toTraceIso(new Date("2026-09-04T12:00:00Z")), "2026-09-04T12:00:00.000Z");
  assert.equal(toTraceIso("2026-09-04T12:00:00Z"), "2026-09-04T12:00:00.000Z");
});

test("trace snapshot is serializable, rejects unknown kinds, and deduplicates relation triples", () => {
  const snapshot = buildEvidenceTraceSnapshot({
    nodes: [...rawNodes, { id: "mystery", type: "mystery", label: "Unknown", date: null }],
    edges: rawEdges,
  });

  assert.equal(snapshot.nodes.length, 4);
  assert.equal(snapshot.relations.length, 4);
  assert.equal(snapshot.nodes[0].occurredAt, "2026-09-01T10:00:00.000Z");
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
});

test("first-order neighborhood returns selected node and only directly related nodes", () => {
  const snapshot = buildEvidenceTraceSnapshot({ nodes: rawNodes, edges: rawEdges });
  const neighborhood = firstOrderNeighborhood(snapshot, "it-1");
  assert.deepEqual([...neighborhood].sort(), ["decision-1", "it-1", "src-1", "test-1"]);

  const sourceNeighborhood = firstOrderNeighborhood(snapshot, "src-1");
  assert.deepEqual([...sourceNeighborhood].sort(), ["it-1", "src-1"]);
});

test("trace deep links are deterministic per evidence kind", () => {
  const snapshot = buildEvidenceTraceSnapshot({ nodes: rawNodes, edges: rawEdges });
  const byId = new Map(snapshot.nodes.map((node) => [node.id, node]));
  assert.equal(deepLinkForTraceNode(byId.get("src-1")!), "/app/inbox?status=linked&event=src-1");
  assert.equal(deepLinkForTraceNode(byId.get("it-1")!), "/app/iterations/it-1");
  assert.equal(deepLinkForTraceNode(byId.get("test-1")!), "/app/tests/test-1");
  assert.equal(deepLinkForTraceNode(byId.get("decision-1")!), "/app/decisions/decision-1");
});

test("semantic trace layout is stable, layered, finite, and independent of input order", () => {
  const a = buildEvidenceTraceSnapshot({ nodes: rawNodes, edges: rawEdges });
  const b = buildEvidenceTraceSnapshot({ nodes: [...rawNodes].reverse(), edges: [...rawEdges].reverse() });
  const la = layoutEvidenceTrace(a);
  const lb = layoutEvidenceTrace(b);

  assert.deepEqual(la.nodes.map((node) => [node.id, node.x, node.y]), lb.nodes.map((node) => [node.id, node.x, node.y]));
  const x = new Map(la.nodes.map((node) => [node.kind, node.x]));
  assert.ok((x.get("source_event") ?? 0) < (x.get("iteration") ?? 0));
  assert.ok((x.get("iteration") ?? 0) < (x.get("test") ?? 0));
  assert.ok((x.get("test") ?? 0) < (x.get("decision") ?? 0));
  assert.ok(la.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
  assert.ok(Number.isFinite(la.bounds.width) && Number.isFinite(la.bounds.height));
});

test("isolated nodes remain visible in semantic layout", () => {
  const snapshot = buildEvidenceTraceSnapshot({
    nodes: [...rawNodes, { id: "test-isolated", type: "test", label: "Isolated test", sublabel: "inconclusive", date: null }],
    edges: rawEdges,
  });
  const layout = layoutEvidenceTrace(snapshot);
  assert.ok(layout.nodes.some((node) => node.id === "test-isolated"));
});


test("visual trace endpoints keep the causal reading order without mutating stored relation direction", () => {
  const snapshot = buildEvidenceTraceSnapshot({ nodes: rawNodes, edges: rawEdges });
  const structural = { id: "fk-test", fromId: "test-1", toId: "it-1", type: "TESTS", origin: "system", status: "accepted" };
  const visual = visualRelationEndpoints(snapshot, structural);
  assert.deepEqual(visual, { source: "it-1", target: "test-1" });
  assert.equal(structural.fromId, "test-1");
  assert.equal(structural.toId, "it-1");
});
