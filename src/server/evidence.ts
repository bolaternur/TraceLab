import { and, count, desc, eq, gte, ilike, inArray, isNull, lt, ne, or, sql, asc } from "drizzle-orm";
import { db } from "@/db";
import {
  annotations,
  artifacts,
  decisions,
  iterations,
  projects,
  relations,
  seasons,
  sourceEvents,
  subsystems,
  teamMemberships,
  tests,
  users,
} from "@/db/schema";

export type EntityType = "source_event" | "artifact" | "iteration" | "test" | "decision" | "subsystem" | "project";

// ---------------------------------------------------------------------------
// Basic team-scoped loaders
// ---------------------------------------------------------------------------
export async function getActiveSeasonAndProject(teamId: string) {
  const season =
    (await db.select().from(seasons).where(and(eq(seasons.teamId, teamId), eq(seasons.isActive, true))).orderBy(desc(seasons.year)).limit(1))[0] ??
    (await db.select().from(seasons).where(eq(seasons.teamId, teamId)).orderBy(desc(seasons.year)).limit(1))[0] ??
    null;
  const project = season
    ? ((await db.select().from(projects).where(and(eq(projects.teamId, teamId), eq(projects.seasonId, season.id))).orderBy(asc(projects.createdAt)).limit(1))[0] ?? null)
    : null;
  return { season, project };
}

export async function listSubsystems(teamId: string, projectId?: string | null) {
  const where = projectId ? and(eq(subsystems.teamId, teamId), eq(subsystems.projectId, projectId)) : eq(subsystems.teamId, teamId);
  return db.select().from(subsystems).where(where).orderBy(asc(subsystems.name));
}

export async function listMembers(teamId: string) {
  return db
    .select({ id: users.id, displayName: users.displayName, email: users.email, role: teamMemberships.role, status: teamMemberships.status, joinedAt: teamMemberships.joinedAt })
    .from(teamMemberships)
    .innerJoin(users, eq(users.id, teamMemberships.userId))
    .where(eq(teamMemberships.teamId, teamId))
    .orderBy(asc(users.displayName));
}

export async function latestAnnotation(entityType: string, entityId: string, field: string) {
  const rows = await db
    .select()
    .from(annotations)
    .where(and(eq(annotations.entityType, entityType), eq(annotations.entityId, entityId), eq(annotations.field, field)))
    .orderBy(desc(annotations.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function annotationHistory(entityType: string, entityId: string) {
  return db
    .select({ a: annotations, author: users.displayName })
    .from(annotations)
    .leftJoin(users, eq(users.id, annotations.authorUserId))
    .where(and(eq(annotations.entityType, entityType), eq(annotations.entityId, entityId)))
    .orderBy(desc(annotations.createdAt));
}

export async function sourceEventContext(teamId: string, eventId: string) {
  const row = (
    await db
      .select({ ev: sourceEvents, actor: users.displayName, subsystem: subsystems.name, artifact: artifacts })
      .from(sourceEvents)
      .leftJoin(users, eq(users.id, sourceEvents.actorUserId))
      .leftJoin(subsystems, eq(subsystems.id, sourceEvents.subsystemId))
      .leftJoin(artifacts, eq(artifacts.sourceEventId, sourceEvents.id))
      .where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.id, eventId)))
      .limit(1)
  )[0];
  if (!row) return null;

  const notes = await db
    .select({ a: annotations, author: users.displayName })
    .from(annotations)
    .leftJoin(users, eq(users.id, annotations.authorUserId))
    .where(and(eq(annotations.teamId, teamId), eq(annotations.entityType, "source_event"), eq(annotations.entityId, eventId)))
    .orderBy(desc(annotations.createdAt));

  return { ...row, notes };
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------
export async function thisWeek(teamId: string) {
  const since = new Date(Date.now() - 7 * 86400_000);
  const byType = await db
    .select({ eventType: sourceEvents.eventType, provider: sourceEvents.provider, n: count() })
    .from(sourceEvents)
    .where(and(eq(sourceEvents.teamId, teamId), gte(sourceEvents.occurredAt, since)))
    .groupBy(sourceEvents.eventType, sourceEvents.provider);
  const testsN = (await db.select({ n: count() }).from(tests).where(and(eq(tests.teamId, teamId), gte(tests.performedAt, since))))[0].n;
  const decisionsN = (await db.select({ n: count() }).from(decisions).where(and(eq(decisions.teamId, teamId), gte(decisions.decidedAt, since))))[0].n;
  const active = await db
    .select({ it: iterations, subsystem: subsystems.name })
    .from(iterations)
    .leftJoin(subsystems, eq(subsystems.id, iterations.subsystemId))
    .where(and(eq(iterations.teamId, teamId), inArray(iterations.state, ["open", "testing", "deciding"])))
    .orderBy(desc(iterations.openedAt))
    .limit(8);
  const recent = await db
    .select({ ev: sourceEvents, actor: users.displayName })
    .from(sourceEvents)
    .leftJoin(users, eq(users.id, sourceEvents.actorUserId))
    .where(eq(sourceEvents.teamId, teamId))
    .orderBy(desc(sourceEvents.occurredAt))
    .limit(10);
  const inboxN = (await db.select({ n: count() }).from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.status, "inbox"))))[0].n;
  const needsContext = await db
    .select({ ev: sourceEvents, actor: users.displayName, subsystem: subsystems.name })
    .from(sourceEvents)
    .leftJoin(users, eq(users.id, sourceEvents.actorUserId))
    .leftJoin(subsystems, eq(subsystems.id, sourceEvents.subsystemId))
    .where(
      and(
        eq(sourceEvents.teamId, teamId),
        eq(sourceEvents.status, "inbox"),
        or(
          ne(sourceEvents.provider, "capture"),
          and(eq(sourceEvents.provider, "capture"), eq(sourceEvents.eventType, "photo"), isNull(sourceEvents.summary)),
        ),
      ),
    )
    .orderBy(desc(sourceEvents.occurredAt))
    .limit(8);
  const sum = (pred: (t: string, p: string) => boolean) => byType.filter((r) => pred(r.eventType, r.provider)).reduce((a, r) => a + Number(r.n), 0);
  return {
    codeChanges: sum((t) => t === "commit" || t === "push"),
    cadRevisions: sum((t) => t === "cad_revision"),
    photos: sum((t) => t === "photo"),
    tests: Number(testsN),
    decisions: Number(decisionsN),
    totalEvents: byType.reduce((a, r) => a + Number(r.n), 0),
    activeIterations: active,
    recent,
    needsContext,
    inboxCount: Number(inboxN),
  };
}

// ---------------------------------------------------------------------------
// Inbox + deterministic clustering
// ---------------------------------------------------------------------------
export async function inbox(teamId: string, opts: { status?: "inbox" | "linked" | "ignored"; limit?: number } = {}) {
  const rows = await db
    .select({ ev: sourceEvents, actor: users.displayName, subsystem: subsystems.name, artifact: artifacts })
    .from(sourceEvents)
    .leftJoin(users, eq(users.id, sourceEvents.actorUserId))
    .leftJoin(subsystems, eq(subsystems.id, sourceEvents.subsystemId))
    .leftJoin(artifacts, eq(artifacts.sourceEventId, sourceEvents.id))
    .where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.status, opts.status ?? "inbox")))
    .orderBy(desc(sourceEvents.occurredAt))
    .limit(opts.limit ?? 100);
  return rows;
}

export interface Cluster {
  key: string;
  label: string;
  reason: string;
  eventIds: string[];
}

/** Deterministic clustering: same subsystem OR same repo/doc, within a 30-minute window. Suggestions only. */
export function clusterEvents(events: Array<{ id: string; occurredAt: Date; subsystemId: string | null; rawMetadata: unknown; provider: string }>): Cluster[] {
  const anchorOf = (ev: (typeof events)[number]) => {
    const meta = (ev.rawMetadata ?? {}) as Record<string, unknown>;
    return ev.subsystemId ? `sub:${ev.subsystemId}` : meta.repository ? `repo:${String(meta.repository)}` : meta.documentId ? `doc:${String(meta.documentId)}` : `prov:${ev.provider}`;
  };
  const groups = new Map<string, typeof events>();
  for (const ev of events) {
    const a = anchorOf(ev);
    groups.set(a, [...(groups.get(a) ?? []), ev]);
  }
  const clusters: Cluster[] = [];
  for (const [anchor, list] of groups) {
    const sorted = [...list].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    let ids: string[] = [];
    let last = -Infinity;
    const flush = () => {
      if (ids.length >= 2) {
        const what = anchor.startsWith("sub") ? "a subsystem" : anchor.startsWith("repo") ? "a repository" : anchor.startsWith("doc") ? "a CAD document" : "a source";
        clusters.push({ key: `${anchor}:${ids[0]}`, label: "Possible iteration", reason: `${ids.length} events share ${what} and occurred within 30 minutes of each other.`, eventIds: ids });
      }
      ids = [];
    };
    for (const ev of sorted) {
      const t = ev.occurredAt.getTime();
      if (ids.length && t - last > 30 * 60_000) flush();
      ids.push(ev.id);
      last = t;
    }
    flush();
  }
  return clusters;
}

// ---------------------------------------------------------------------------
// Graph & Why?
// ---------------------------------------------------------------------------
export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  sublabel?: string;
  date?: Date | null;
  subsystemId?: string | null;
  outcome?: string | null;
  provider?: string | null;
}
export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  origin: string;
  status: string;
}

export async function evidenceGraph(teamId: string, opts: { subsystemId?: string | null; since?: Date | null } = {}) {
  const its = await db.select().from(iterations).where(and(eq(iterations.teamId, teamId), opts.subsystemId ? eq(iterations.subsystemId, opts.subsystemId) : undefined));
  const ts = await db.select().from(tests).where(and(eq(tests.teamId, teamId), opts.subsystemId ? eq(tests.subsystemId, opts.subsystemId) : undefined));
  const ds = await db.select().from(decisions).where(and(eq(decisions.teamId, teamId), opts.subsystemId ? eq(decisions.subsystemId, opts.subsystemId) : undefined));
  const evs = await db
    .select()
    .from(sourceEvents)
    .where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.status, "linked"), opts.subsystemId ? eq(sourceEvents.subsystemId, opts.subsystemId) : undefined))
    .limit(400);
  const nodes: GraphNode[] = [
    ...its.map((i) => ({ id: i.id, type: "iteration" as const, label: i.title, sublabel: i.state, date: i.openedAt, subsystemId: i.subsystemId, outcome: i.outcome })),
    ...ts.map((t) => ({ id: t.id, type: "test" as const, label: t.title, sublabel: testResultLabel(t), date: t.performedAt, subsystemId: t.subsystemId, outcome: t.outcome })),
    ...ds.map((d) => ({ id: d.id, type: "decision" as const, label: d.title, sublabel: d.disposition, date: d.decidedAt, subsystemId: d.subsystemId, outcome: d.disposition })),
    ...evs.map((e) => ({ id: e.id, type: "source_event" as const, label: e.title, sublabel: `${e.provider} · ${e.eventType}`, date: e.occurredAt, subsystemId: e.subsystemId, provider: e.provider })),
  ];
  const ids = new Set(nodes.map((n) => n.id));
  const rels = await db.select().from(relations).where(and(eq(relations.teamId, teamId), inArray(relations.status, ["accepted", "suggested"])));
  const edges: GraphEdge[] = [];
  for (const r of rels) {
    if (ids.has(r.fromId) && ids.has(r.toId)) edges.push({ id: r.id, from: r.fromId, to: r.toId, type: r.relationType, origin: r.origin, status: r.status });
  }
  // implicit structural edges from foreign keys
  for (const t of ts) if (t.iterationId && ids.has(t.iterationId)) edges.push({ id: `fk-t-${t.id}`, from: t.id, to: t.iterationId, type: "TESTS", origin: "system", status: "accepted" });
  for (const d of ds) if (d.iterationId && ids.has(d.iterationId)) edges.push({ id: `fk-d-${d.id}`, from: d.id, to: d.iterationId, type: "RESPONDS_TO", origin: "system", status: "accepted" });
  for (const e of evs) if (e.iterationId && ids.has(e.iterationId)) edges.push({ id: `fk-e-${e.id}`, from: e.id, to: e.iterationId, type: "SUPPORTS", origin: "system", status: "accepted" });
  const seen = new Set<string>();
  return { nodes, edges: edges.filter((e) => (seen.has(`${e.from}|${e.to}|${e.type}`) ? false : (seen.add(`${e.from}|${e.to}|${e.type}`), true))) };
}

export function testResultLabel(t: typeof tests.$inferSelect): string {
  if (t.trials != null && t.successes != null) return `${t.successes} / ${t.trials}`;
  if (t.value != null) return `${t.value}${t.units ? " " + t.units : ""}`;
  return t.outcome;
}

export function relativeImprovement(before: { successes: number; trials: number }, after: { successes: number; trials: number }): number | null {
  if (before.trials <= 0 || after.trials <= 0 || before.successes <= 0) return null;
  const a = before.successes / before.trials;
  const b = after.successes / after.trials;
  return Math.round(((b - a) / a) * 1000) / 10;
}

/** Deterministic "Why?" — graph traversal from any entity to decisions, tests, rationale and sources. No LLM. */
export async function explainWhy(teamId: string, entityType: EntityType, entityId: string) {
  const directRels = await db
    .select()
    .from(relations)
    .where(and(eq(relations.teamId, teamId), eq(relations.status, "accepted"), or(eq(relations.fromId, entityId), eq(relations.toId, entityId))));
  const neighborIds = new Set<string>();
  for (const r of directRels) neighborIds.add(r.fromId === entityId ? r.toId : r.fromId);

  let iterationId: string | null = null;
  let subsystemId: string | null = null;
  let title = "";
  if (entityType === "iteration") {
    const [i] = await db.select().from(iterations).where(and(eq(iterations.id, entityId), eq(iterations.teamId, teamId)));
    if (!i) return null;
    iterationId = i.id;
    subsystemId = i.subsystemId;
    title = i.title;
  } else if (entityType === "test") {
    const [t] = await db.select().from(tests).where(and(eq(tests.id, entityId), eq(tests.teamId, teamId)));
    if (!t) return null;
    iterationId = t.iterationId;
    subsystemId = t.subsystemId;
    title = t.title;
  } else if (entityType === "decision") {
    const [d] = await db.select().from(decisions).where(and(eq(decisions.id, entityId), eq(decisions.teamId, teamId)));
    if (!d) return null;
    iterationId = d.iterationId;
    subsystemId = d.subsystemId;
    title = d.title;
  } else if (entityType === "source_event") {
    const [e] = await db.select().from(sourceEvents).where(and(eq(sourceEvents.id, entityId), eq(sourceEvents.teamId, teamId)));
    if (!e) return null;
    iterationId = e.iterationId;
    subsystemId = e.subsystemId;
    title = e.title;
  } else {
    return null;
  }

  const idList = [entityId, ...neighborIds];
  const its = iterationId ? await db.select().from(iterations).where(and(eq(iterations.teamId, teamId), eq(iterations.id, iterationId))) : [];
  const ds = await db
    .select()
    .from(decisions)
    .where(and(eq(decisions.teamId, teamId), or(inArray(decisions.id, idList), iterationId ? eq(decisions.iterationId, iterationId) : sql`false`)))
    .orderBy(desc(decisions.decidedAt));
  const ts = await db
    .select()
    .from(tests)
    .where(and(eq(tests.teamId, teamId), or(inArray(tests.id, idList), iterationId ? eq(tests.iterationId, iterationId) : sql`false`)))
    .orderBy(asc(tests.performedAt));
  const evs = await db
    .select()
    .from(sourceEvents)
    .where(and(eq(sourceEvents.teamId, teamId), or(inArray(sourceEvents.id, idList), iterationId ? eq(sourceEvents.iterationId, iterationId) : sql`false`)))
    .orderBy(asc(sourceEvents.occurredAt))
    .limit(30);

  const rationaleTargets = [...ds.map((d) => d.id), ...its.map((i) => i.id), entityId];
  const rationale = await db
    .select({ a: annotations, author: users.displayName })
    .from(annotations)
    .leftJoin(users, eq(users.id, annotations.authorUserId))
    .where(and(eq(annotations.teamId, teamId), inArray(annotations.entityId, rationaleTargets), eq(annotations.provenance, "student")))
    .orderBy(desc(annotations.createdAt));
  // Only latest per (entity, field)
  const latest = new Map<string, (typeof rationale)[number]>();
  for (const r of rationale) {
    const k = `${r.a.entityType}:${r.a.entityId}:${r.a.field}`;
    if (!latest.has(k)) latest.set(k, r);
  }

  const quant = ts.filter((t) => t.trials != null && t.successes != null);
  let comparison: { before: (typeof ts)[number]; after: (typeof ts)[number]; improvement: number | null } | null = null;
  if (quant.length >= 2) {
    const before = quant[0];
    const after = quant[quant.length - 1];
    comparison = { before, after, improvement: relativeImprovement({ successes: before.successes!, trials: before.trials! }, { successes: after.successes!, trials: after.trials! }) };
  }
  return { title, entityType, entityId, iteration: its[0] ?? null, subsystemId, decisions: ds, tests: ts, events: evs, rationale: [...latest.values()], comparison, relations: directRels };
}

// ---------------------------------------------------------------------------
// Timeline / season memory
// ---------------------------------------------------------------------------
export async function subsystemTimeline(teamId: string, subsystemId: string | null, opts: { from?: Date; to?: Date } = {}) {
  const sub = subsystemId ? eq(sourceEvents.subsystemId, subsystemId) : undefined;
  const evs = await db
    .select()
    .from(sourceEvents)
    .where(and(eq(sourceEvents.teamId, teamId), sub, opts.from ? gte(sourceEvents.occurredAt, opts.from) : undefined, opts.to ? lt(sourceEvents.occurredAt, opts.to) : undefined))
    .orderBy(asc(sourceEvents.occurredAt))
    .limit(300);
  const ts = await db.select().from(tests).where(and(eq(tests.teamId, teamId), subsystemId ? eq(tests.subsystemId, subsystemId) : undefined)).orderBy(asc(tests.performedAt));
  const ds = await db.select().from(decisions).where(and(eq(decisions.teamId, teamId), subsystemId ? eq(decisions.subsystemId, subsystemId) : undefined)).orderBy(asc(decisions.decidedAt));
  const its = await db.select().from(iterations).where(and(eq(iterations.teamId, teamId), subsystemId ? eq(iterations.subsystemId, subsystemId) : undefined)).orderBy(asc(iterations.openedAt));
  type Item = {
    id: string;
    at: Date;
    kind: "event" | "test" | "decision" | "iteration_open" | "iteration_close";
    title: string;
    detail: string;
    href: string;
    tone: "neutral" | "success" | "danger" | "warning";
    iterationId: string | null;
    subsystemId: string | null;
    provider: string | null;
    eventType: string | null;
  };
  const items: Item[] = [];
  for (const e of evs) if (e.provider !== "capture" || e.eventType === "photo" || e.eventType === "problem" || e.eventType === "reflection") items.push({ id: e.id, at: e.occurredAt, kind: "event", title: e.title, detail: `${e.provider} · ${e.eventType}`, href: `/app/inbox?event=${e.id}`, tone: e.eventType === "problem" ? "warning" : "neutral", iterationId: e.iterationId, subsystemId: e.subsystemId, provider: e.provider, eventType: e.eventType });
  for (const t of ts) items.push({ id: t.id, at: t.performedAt, kind: "test", title: t.title, detail: testResultLabel(t), href: `/app/tests/${t.id}`, tone: t.outcome === "pass" ? "success" : t.outcome === "fail" ? "danger" : "neutral", iterationId: t.iterationId, subsystemId: t.subsystemId, provider: null, eventType: null });
  for (const d of ds) items.push({ id: d.id, at: d.decidedAt, kind: "decision", title: d.title, detail: d.disposition, href: `/app/decisions/${d.id}`, tone: d.disposition === "reject" || d.disposition === "revert" ? "danger" : d.disposition === "keep" ? "success" : "neutral", iterationId: d.iterationId, subsystemId: d.subsystemId, provider: null, eventType: null });
  for (const i of its) {
    items.push({ id: `${i.id}-open`, at: i.openedAt, kind: "iteration_open", title: i.title, detail: "Iteration opened", href: `/app/iterations/${i.id}`, tone: "neutral", iterationId: i.id, subsystemId: i.subsystemId, provider: null, eventType: null });
    if (i.closedAt) items.push({ id: `${i.id}-close`, at: i.closedAt, kind: "iteration_close", title: i.title, detail: `Closed · ${i.outcome ?? "no outcome"}`, href: `/app/iterations/${i.id}`, tone: i.outcome === "rejected" ? "danger" : i.outcome === "kept" ? "success" : "neutral", iterationId: i.id, subsystemId: i.subsystemId, provider: null, eventType: null });
  }
  items.sort((a, b) => a.at.getTime() - b.at.getTime());
  return items;
}

// ---------------------------------------------------------------------------
// Failure library / "We already tried this"
// ---------------------------------------------------------------------------
export async function failureLibrary(teamId: string) {
  const rejected = await db
    .select({ it: iterations, subsystem: subsystems.name, season: seasons.name })
    .from(iterations)
    .leftJoin(subsystems, eq(subsystems.id, iterations.subsystemId))
    .innerJoin(projects, eq(projects.id, iterations.projectId))
    .innerJoin(seasons, eq(seasons.id, projects.seasonId))
    .where(and(eq(iterations.teamId, teamId), inArray(iterations.outcome, ["rejected", "reverted"])))
    .orderBy(desc(iterations.closedAt));
  const failedTests = await db
    .select({ t: tests, subsystem: subsystems.name })
    .from(tests)
    .leftJoin(subsystems, eq(subsystems.id, tests.subsystemId))
    .where(and(eq(tests.teamId, teamId), eq(tests.outcome, "fail")))
    .orderBy(desc(tests.performedAt));
  const conclusions = rejected.length
    ? await db
        .select()
        .from(annotations)
        .where(and(eq(annotations.teamId, teamId), inArray(annotations.entityId, rejected.map((r) => r.it.id)), inArray(annotations.field, ["next_step", "rationale", "reflection"])))
        .orderBy(desc(annotations.createdAt))
    : [];
  return { rejected, failedTests, conclusions };
}

export async function similarHistory(teamId: string, text: string, excludeSeasonId?: string | null) {
  const words = text
    .toLowerCase()
    .split(/[^a-zа-яё0-9]+/i)
    .filter((w) => w.length >= 4)
    .slice(0, 6);
  if (words.length === 0) return [];
  const conds = words.map((w) => ilike(iterations.title, `%${w}%`));
  const rows = await db
    .select({ it: iterations, season: seasons.name, seasonId: seasons.id, subsystem: subsystems.name })
    .from(iterations)
    .innerJoin(projects, eq(projects.id, iterations.projectId))
    .innerJoin(seasons, eq(seasons.id, projects.seasonId))
    .leftJoin(subsystems, eq(subsystems.id, iterations.subsystemId))
    .where(and(eq(iterations.teamId, teamId), or(...conds)))
    .orderBy(desc(iterations.openedAt))
    .limit(6);
  return rows.filter((r) => !excludeSeasonId || r.seasonId !== excludeSeasonId);
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export async function search(teamId: string, q: string, filters: { type?: string; subsystemId?: string | null } = {}) {
  const like = `%${q}%`;
  const sub = filters.subsystemId ?? null;
  const out: Array<{ type: EntityType; id: string; title: string; detail: string; at: Date; href: string }> = [];
  if (!filters.type || filters.type === "iteration") {
    const rows = await db.select().from(iterations).where(and(eq(iterations.teamId, teamId), sub ? eq(iterations.subsystemId, sub) : undefined, or(ilike(iterations.title, like), ilike(iterations.problemOrGoal, like), ilike(iterations.changeSummary, like)))).limit(20);
    out.push(...rows.map((r) => ({ type: "iteration" as const, id: r.id, title: r.title, detail: `${r.state}${r.outcome ? " · " + r.outcome : ""}`, at: r.openedAt, href: `/app/iterations/${r.id}` })));
  }
  if (!filters.type || filters.type === "test") {
    const rows = await db.select().from(tests).where(and(eq(tests.teamId, teamId), sub ? eq(tests.subsystemId, sub) : undefined, or(ilike(tests.title, like), ilike(tests.observations, like), ilike(tests.procedure, like), ilike(tests.question, like)))).limit(20);
    out.push(...rows.map((r) => ({ type: "test" as const, id: r.id, title: r.title, detail: testResultLabel(r), at: r.performedAt, href: `/app/tests/${r.id}` })));
  }
  if (!filters.type || filters.type === "decision") {
    const rows = await db.select().from(decisions).where(and(eq(decisions.teamId, teamId), sub ? eq(decisions.subsystemId, sub) : undefined, ilike(decisions.title, like))).limit(20);
    out.push(...rows.map((r) => ({ type: "decision" as const, id: r.id, title: r.title, detail: r.disposition, at: r.decidedAt, href: `/app/decisions?focus=${r.id}` })));
  }
  if (!filters.type || filters.type === "source_event") {
    const rows = await db.select().from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), sub ? eq(sourceEvents.subsystemId, sub) : undefined, or(ilike(sourceEvents.title, like), ilike(sourceEvents.summary, like)))).limit(20);
    out.push(...rows.map((r) => ({ type: "source_event" as const, id: r.id, title: r.title, detail: `${r.provider} · ${r.eventType}`, at: r.occurredAt, href: `/app/inbox?event=${r.id}` })));
  }
  if (!filters.type || filters.type === "annotation") {
    const rows = await db.select().from(annotations).where(and(eq(annotations.teamId, teamId), ilike(annotations.body, like))).orderBy(desc(annotations.createdAt)).limit(20);
    out.push(...rows.map((r) => ({ type: r.entityType as EntityType, id: r.entityId, title: r.body.slice(0, 120), detail: `student ${r.field}`, at: r.createdAt, href: hrefFor(r.entityType as EntityType, r.entityId) })));
  }
  out.sort((a, b) => b.at.getTime() - a.at.getTime());
  return out;
}

export function hrefFor(type: EntityType, id: string) {
  switch (type) {
    case "iteration":
      return `/app/iterations/${id}`;
    case "test":
      return `/app/tests/${id}`;
    case "decision":
      return `/app/decisions?focus=${id}`;
    case "source_event":
      return `/app/inbox?event=${id}`;
    default:
      return `/app/search`;
  }
}

// ---------------------------------------------------------------------------
// Handoff, contribution, coach insights
// ---------------------------------------------------------------------------
export async function seasonHandoff(teamId: string, seasonId: string) {
  const subs = await db.select().from(subsystems).innerJoin(projects, eq(projects.id, subsystems.projectId)).where(and(eq(subsystems.teamId, teamId), eq(projects.seasonId, seasonId)));
  const sections = [];
  for (const { subsystems: s } of subs) {
    const keyDecisions = await db.select().from(decisions).where(and(eq(decisions.subsystemId, s.id), eq(decisions.status, "closed"))).orderBy(desc(decisions.decidedAt)).limit(6);
    const failed = await db.select().from(iterations).where(and(eq(iterations.subsystemId, s.id), inArray(iterations.outcome, ["rejected", "reverted"]))).limit(6);
    const importantTests = await db.select().from(tests).where(and(eq(tests.subsystemId, s.id), inArray(tests.outcome, ["pass", "fail"]))).orderBy(desc(tests.performedAt)).limit(6);
    const open = await db.select().from(iterations).where(and(eq(iterations.subsystemId, s.id), inArray(iterations.state, ["open", "testing", "deciding"]))).limit(6);
    const notes = await db.select().from(annotations).where(and(eq(annotations.entityType, "subsystem"), eq(annotations.entityId, s.id))).orderBy(desc(annotations.createdAt)).limit(3);
    sections.push({ subsystem: s, keyDecisions, failed, importantTests, open, notes });
  }
  return sections;
}

export async function contributionMap(teamId: string, userId: string) {
  const commits = (await db.select({ n: count() }).from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.actorUserId, userId), inArray(sourceEvents.eventType, ["commit", "push"]))))[0].n;
  const cad = (await db.select({ n: count() }).from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.actorUserId, userId), eq(sourceEvents.eventType, "cad_revision"))))[0].n;
  const photos = (await db.select({ n: count() }).from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.actorUserId, userId), eq(sourceEvents.eventType, "photo"))))[0].n;
  const myTests = await db.select().from(tests).where(and(eq(tests.teamId, teamId), eq(tests.createdBy, userId)));
  const myDecisions = await db.select().from(decisions).where(and(eq(decisions.teamId, teamId), eq(decisions.authorUserId, userId)));
  const myIterations = await db.select().from(iterations).where(and(eq(iterations.teamId, teamId), eq(iterations.createdBy, userId)));
  const myAnnotations = (await db.select({ n: count() }).from(annotations).where(and(eq(annotations.teamId, teamId), eq(annotations.authorUserId, userId), eq(annotations.provenance, "student"))))[0].n;
  const decisionIds = myDecisions.map((d) => d.id);
  const evidenceLinked = decisionIds.length
    ? new Set((await db.select({ id: relations.fromId }).from(relations).where(and(eq(relations.teamId, teamId), inArray(relations.fromId, decisionIds), eq(relations.status, "accepted")))).map((r) => r.id)).size
    : 0;
  const quantTests = myTests.filter((t) => t.trials != null || t.value != null).length;
  const subsystemsTouched = new Set([...myTests.map((t) => t.subsystemId), ...myDecisions.map((d) => d.subsystemId), ...myIterations.map((i) => i.subsystemId)].filter(Boolean)).size;
  return {
    commits: Number(commits),
    cadRevisions: Number(cad),
    photos: Number(photos),
    tests: myTests.length,
    quantitativeTests: quantTests,
    decisions: myDecisions.length,
    decisionsWithEvidence: evidenceLinked,
    iterations: myIterations.length,
    annotations: Number(myAnnotations),
    subsystemsTouched,
    testIds: myTests.map((t) => t.id),
    decisionIds,
    iterationIds: myIterations.map((i) => i.id),
  };
}

export async function coachInsights(teamId: string) {
  const [lastTest] = await db.select({ at: tests.performedAt }).from(tests).where(eq(tests.teamId, teamId)).orderBy(desc(tests.performedAt)).limit(1);
  const allDecisions = await db.select({ id: decisions.id, title: decisions.title }).from(decisions).where(eq(decisions.teamId, teamId));
  const linkedDecisionIds = new Set(
    (await db.select({ id: relations.fromId }).from(relations).where(and(eq(relations.teamId, teamId), eq(relations.fromType, "decision"), eq(relations.status, "accepted")))).map((r) => r.id),
  );
  const decisionsWithoutEvidence = allDecisions.filter((d) => !linkedDecisionIds.has(d.id));
  const allTests = await db.select({ id: tests.id, title: tests.title, iterationId: tests.iterationId }).from(tests).where(eq(tests.teamId, teamId));
  const testsLinkedToDecision = new Set(
    (await db.select({ id: relations.toId }).from(relations).where(and(eq(relations.teamId, teamId), eq(relations.fromType, "decision"), eq(relations.toType, "test"), eq(relations.status, "accepted")))).map((r) => r.id),
  );
  const testsWithoutDecision = allTests.filter((t) => !testsLinkedToDecision.has(t.id));
  const inboxEvents = await db.select({ id: sourceEvents.id, occurredAt: sourceEvents.occurredAt, subsystemId: sourceEvents.subsystemId, rawMetadata: sourceEvents.rawMetadata, provider: sourceEvents.provider }).from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.status, "inbox")));
  const clusters = clusterEvents(inboxEvents);
  const since = new Date(Date.now() - 30 * 86400_000);
  const active = await db.select({ id: teamMemberships.userId }).from(teamMemberships).where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.status, "active"), inArray(teamMemberships.role, ["student", "student_lead"])));
  const contributors = await db.selectDistinct({ id: sourceEvents.actorUserId }).from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), gte(sourceEvents.occurredAt, since)));
  const contributorSet = new Set(contributors.map((c) => c.id).filter(Boolean));
  const openDecisions = await db.select({ n: count() }).from(decisions).where(and(eq(decisions.teamId, teamId), eq(decisions.status, "open")));
  const stale = await db.select({ n: count() }).from(iterations).where(and(eq(iterations.teamId, teamId), inArray(iterations.state, ["open", "testing", "deciding"]), lt(iterations.openedAt, new Date(Date.now() - 21 * 86400_000))));
  const unclassified = await db.select({ n: count() }).from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.status, "inbox"), isNull(sourceEvents.subsystemId)));
  return {
    daysSinceLastTest: lastTest ? Math.floor((Date.now() - lastTest.at.getTime()) / 86400_000) : null,
    decisionsWithoutEvidence,
    testsWithoutDecision,
    unresolvedClusters: clusters.length,
    contributorsThisMonth: [...active].filter((m) => contributorSet.has(m.id)).length,
    activeMembers: active.length,
    openDecisions: Number(openDecisions[0].n),
    staleIterations: Number(stale[0].n),
    unclassifiedEvents: Number(unclassified[0].n),
    decisionEvidenceRate: allDecisions.length ? Math.round(((allDecisions.length - decisionsWithoutEvidence.length) / allDecisions.length) * 100) : null,
  };
}
