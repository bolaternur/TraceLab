import type {
  EvidenceTraceKind,
  EvidenceTraceNode,
  EvidenceTraceRelation,
  EvidenceTraceSnapshot,
} from "./types.ts";

const TRACE_KINDS = new Set<EvidenceTraceKind>(["source_event", "iteration", "test", "decision"]);

const VISUAL_KIND_ORDER: Record<EvidenceTraceKind, number> = {
  source_event: 0,
  iteration: 1,
  test: 2,
  decision: 3,
};

interface RawTraceNode {
  id?: unknown;
  type?: unknown;
  label?: unknown;
  sublabel?: unknown;
  date?: Date | string | null;
  subsystemId?: unknown;
  outcome?: unknown;
  provider?: unknown;
}

interface RawTraceRelation {
  id?: unknown;
  from?: unknown;
  to?: unknown;
  type?: unknown;
  origin?: unknown;
  status?: unknown;
}

export function toTraceIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (!(date instanceof Date)) return null;
  const time = date.getTime();
  return Number.isFinite(time) ? date.toISOString() : null;
}

function isTraceKind(value: unknown): value is EvidenceTraceKind {
  return typeof value === "string" && TRACE_KINDS.has(value as EvidenceTraceKind);
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeNode(raw: RawTraceNode): EvidenceTraceNode | null {
  if (typeof raw.id !== "string" || !raw.id || !isTraceKind(raw.type) || typeof raw.label !== "string" || !raw.label) return null;
  return {
    id: raw.id,
    kind: raw.type,
    label: raw.label,
    detail: toNullableString(raw.sublabel),
    occurredAt: toTraceIso(raw.date),
    subsystemId: toNullableString(raw.subsystemId),
    outcome: toNullableString(raw.outcome),
    provider: toNullableString(raw.provider),
  };
}

function normalizeRelation(raw: RawTraceRelation, knownIds: ReadonlySet<string>): EvidenceTraceRelation | null {
  if (
    typeof raw.id !== "string" ||
    typeof raw.from !== "string" ||
    typeof raw.to !== "string" ||
    typeof raw.type !== "string" ||
    !knownIds.has(raw.from) ||
    !knownIds.has(raw.to)
  ) {
    return null;
  }
  return {
    id: raw.id,
    fromId: raw.from,
    toId: raw.to,
    type: raw.type,
    origin: typeof raw.origin === "string" && raw.origin ? raw.origin : "unknown",
    status: typeof raw.status === "string" && raw.status ? raw.status : "accepted",
  };
}

export function buildEvidenceTraceSnapshot(input: {
  nodes: readonly RawTraceNode[];
  edges: readonly RawTraceRelation[];
}): EvidenceTraceSnapshot {
  const nodes = input.nodes
    .map(normalizeNode)
    .filter((node): node is EvidenceTraceNode => node !== null)
    .sort((a, b) => {
      const kindDelta = VISUAL_KIND_ORDER[a.kind] - VISUAL_KIND_ORDER[b.kind];
      if (kindDelta) return kindDelta;
      const dateDelta = (a.occurredAt ?? "9999").localeCompare(b.occurredAt ?? "9999");
      if (dateDelta) return dateDelta;
      return a.id.localeCompare(b.id);
    });
  const knownIds = new Set(nodes.map((node) => node.id));
  const seenTriples = new Set<string>();
  const relations: EvidenceTraceRelation[] = [];

  for (const raw of input.edges) {
    const relation = normalizeRelation(raw, knownIds);
    if (!relation) continue;
    const key = `${relation.fromId}|${relation.toId}|${relation.type}`;
    if (seenTriples.has(key)) continue;
    seenTriples.add(key);
    relations.push(relation);
  }

  return { nodes, relations };
}

export function firstOrderNeighborhood(snapshot: EvidenceTraceSnapshot, selectedId: string | null): Set<string> {
  const ids = new Set<string>();
  if (!selectedId || !snapshot.nodes.some((node) => node.id === selectedId)) return ids;
  ids.add(selectedId);
  for (const relation of snapshot.relations) {
    if (relation.fromId === selectedId) ids.add(relation.toId);
    if (relation.toId === selectedId) ids.add(relation.fromId);
  }
  return ids;
}

export function deepLinkForTraceNode(node: EvidenceTraceNode): string {
  switch (node.kind) {
    case "iteration":
      return `/app/iterations/${node.id}`;
    case "test":
      return `/app/tests/${node.id}`;
    case "decision":
      return `/app/decisions/${node.id}`;
    case "source_event":
      return `/app/inbox?status=linked&event=${node.id}`;
  }
}

export function whyLinkForTraceNode(node: EvidenceTraceNode): string {
  return `/app/why/${node.kind}/${node.id}`;
}


export function visualRelationEndpoints(
  snapshot: EvidenceTraceSnapshot,
  relation: Pick<EvidenceTraceRelation, "fromId" | "toId">,
): { source: string; target: string } {
  const from = snapshot.nodes.find((node) => node.id === relation.fromId);
  const to = snapshot.nodes.find((node) => node.id === relation.toId);
  if (!from || !to) return { source: relation.fromId, target: relation.toId };
  const fromRank = VISUAL_KIND_ORDER[from.kind];
  const toRank = VISUAL_KIND_ORDER[to.kind];
  if (fromRank > toRank) return { source: relation.toId, target: relation.fromId };
  return { source: relation.fromId, target: relation.toId };
}
