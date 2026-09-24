import type {
  ActiveIterationItem,
  DecisionSummary,
  NeedsContextItem,
  RecentEvidenceItem,
  TestSummary,
  WorkbenchPolicyStatus,
  WorkbenchSnapshot,
} from "./types.ts";

export function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  const time = date.getTime();
  return Number.isNaN(time) ? null : date.toISOString();
}

interface SourceEventLike {
  id: string;
  provider: string;
  eventType: string;
  title: string;
  occurredAt?: Date | string | null;
  status?: string | null;
  summary?: string | null;
  subsystemId?: string | null;
}

interface IterationLike {
  id: string;
  title: string;
  state: string;
  openedAt?: Date | string | null;
  subsystemId?: string | null;
}

interface TestLike {
  id: string;
  title: string;
  outcome?: string | null;
  performedAt?: Date | string | null;
  successes?: number | null;
  trials?: number | null;
  value?: string | null;
  units?: string | null;
}

interface DecisionLike {
  id: string;
  title: string;
  disposition: string;
  status: string;
  decidedAt?: Date | string | null;
}

export interface WorkbenchSnapshotInput {
  team: {
    id: string;
    name: string;
    number?: string | null;
    program: string;
    timezone: string;
  };
  season?: { id: string; year?: number | null; name?: string | null } | null;
  project?: { id: string; title: string } | null;
  policy?: { status?: string | null; strict?: boolean | null } | null;
  week: {
    needsContext: Array<{ ev: SourceEventLike; actor?: string | null; subsystem?: string | null }>;
    recent: Array<{ ev: SourceEventLike; actor?: string | null; subsystem?: string | null }>;
    activeIterations: Array<{ it: IterationLike; subsystem?: string | null }>;
    tests: number;
    decisions: number;
    inboxCount: number;
    totalEvents: number;
  };
  recentTests?: Array<{ t: TestLike; subsystem?: string | null }>;
  recentDecisions?: Array<{ d: DecisionLike; subsystem?: string | null }>;
}

function normalizePolicyStatus(status: string | null | undefined): WorkbenchPolicyStatus {
  if (status === "needs_review" || status === "draft" || status === "superseded") return "needs_review";
  if (status === "restricted" || status === "blocked") return "restricted";
  return "clear";
}

function mapNeedsContext(row: WorkbenchSnapshotInput["week"]["needsContext"][number]): NeedsContextItem {
  return {
    id: row.ev.id,
    provider: row.ev.provider,
    eventType: row.ev.eventType,
    title: row.ev.title,
    occurredAt: toIso(row.ev.occurredAt),
    actor: row.actor ?? null,
    subsystem: row.subsystem ?? null,
    summary: row.ev.summary ?? null,
  };
}

function mapRecent(row: WorkbenchSnapshotInput["week"]["recent"][number]): RecentEvidenceItem {
  return {
    id: row.ev.id,
    provider: row.ev.provider,
    eventType: row.ev.eventType,
    title: row.ev.title,
    occurredAt: toIso(row.ev.occurredAt),
    actor: row.actor ?? null,
    subsystemId: row.ev.subsystemId ?? null,
    status: row.ev.status ?? null,
  };
}

function mapIteration(row: WorkbenchSnapshotInput["week"]["activeIterations"][number]): ActiveIterationItem {
  return {
    id: row.it.id,
    title: row.it.title,
    state: row.it.state,
    openedAt: toIso(row.it.openedAt),
    subsystemId: row.it.subsystemId ?? null,
    subsystem: row.subsystem ?? null,
  };
}

function mapTest(row: NonNullable<WorkbenchSnapshotInput["recentTests"]>[number]): TestSummary {
  return {
    id: row.t.id,
    title: row.t.title,
    outcome: row.t.outcome ?? null,
    performedAt: toIso(row.t.performedAt),
    subsystem: row.subsystem ?? null,
    successes: row.t.successes ?? null,
    trials: row.t.trials ?? null,
    value: row.t.value ?? null,
    units: row.t.units ?? null,
  };
}

function mapDecision(row: NonNullable<WorkbenchSnapshotInput["recentDecisions"]>[number]): DecisionSummary {
  return {
    id: row.d.id,
    title: row.d.title,
    disposition: row.d.disposition,
    status: row.d.status,
    decidedAt: toIso(row.d.decidedAt),
    subsystem: row.subsystem ?? null,
  };
}

export function buildWorkbenchSnapshot(input: WorkbenchSnapshotInput): WorkbenchSnapshot {
  return {
    team: {
      id: input.team.id,
      name: input.team.name,
      number: input.team.number ?? null,
      program: input.team.program,
      timezone: input.team.timezone,
    },
    project: {
      id: input.project?.id ?? null,
      seasonId: input.season?.id ?? null,
      title: input.project?.title ?? null,
      seasonLabel: input.season?.name ?? (input.season?.year ? String(input.season.year) : null),
    },
    policy: {
      status: normalizePolicyStatus(input.policy?.status),
      strict: Boolean(input.policy?.strict),
    },
    needsContext: input.week.needsContext.map(mapNeedsContext),
    recentEvidence: input.week.recent.map(mapRecent),
    activeIterations: input.week.activeIterations.map(mapIteration),
    recentTests: (input.recentTests ?? []).map(mapTest),
    recentDecisions: (input.recentDecisions ?? []).map(mapDecision),
    counts: {
      inbox: Number(input.week.inboxCount) || 0,
      tests: Number(input.week.tests) || 0,
      decisions: Number(input.week.decisions) || 0,
      needsContext: input.week.needsContext.length,
    },
  };
}
