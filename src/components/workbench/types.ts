export type WorkboardKind =
  | "needs-context"
  | "active-iteration"
  | "recent-evidence"
  | "test-bench"
  | "decision-trail"
  | "process-health";

export type WorkbenchPolicyStatus = "clear" | "needs_review" | "restricted";

export interface WorkbenchTeamSummary {
  id: string;
  name: string;
  number: string | null;
  program: string;
  timezone: string;
}

export interface WorkbenchProjectSummary {
  id: string | null;
  seasonId: string | null;
  title: string | null;
  seasonLabel: string | null;
}

export interface NeedsContextItem {
  id: string;
  provider: string;
  eventType: string;
  title: string;
  occurredAt: string | null;
  actor: string | null;
  subsystem: string | null;
  summary: string | null;
}

export interface RecentEvidenceItem {
  id: string;
  provider: string;
  eventType: string;
  title: string;
  occurredAt: string | null;
  actor: string | null;
  subsystemId: string | null;
  status: string | null;
}

export interface ActiveIterationItem {
  id: string;
  title: string;
  state: string;
  openedAt: string | null;
  subsystemId: string | null;
  subsystem: string | null;
}

export interface TestSummary {
  id: string;
  title: string;
  outcome: string | null;
  performedAt: string | null;
  subsystem: string | null;
  successes: number | null;
  trials: number | null;
  value: string | null;
  units: string | null;
}

export interface DecisionSummary {
  id: string;
  title: string;
  disposition: string;
  status: string;
  decidedAt: string | null;
  subsystem: string | null;
}

export interface WorkbenchSnapshot {
  team: WorkbenchTeamSummary;
  project: WorkbenchProjectSummary;
  policy: {
    status: WorkbenchPolicyStatus;
    strict: boolean;
  };
  needsContext: NeedsContextItem[];
  recentEvidence: RecentEvidenceItem[];
  activeIterations: ActiveIterationItem[];
  recentTests: TestSummary[];
  recentDecisions: DecisionSummary[];
  counts: {
    inbox: number;
    tests: number;
    decisions: number;
    needsContext: number;
  };
}

export interface WorkbenchNodeModel {
  id: WorkboardKind;
  kind: WorkboardKind;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkbenchEdgeModel {
  id: string;
  source: WorkboardKind;
  target: WorkboardKind;
  relation: "context-to-iteration" | "iteration-to-test" | "test-to-decision" | "evidence-to-iteration";
}

export type WorkbenchExtent = [[number, number], [number, number]];
