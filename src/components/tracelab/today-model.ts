export interface NeedsContextLike {
  id: string;
  provider: string;
  eventType: string;
  occurredAt: Date | string;
}

export type NeedsContextRowLike = NeedsContextLike | { ev: NeedsContextLike };

const AUTO_SOURCE_WEIGHT: Record<string, number> = {
  github: 30,
  onshape: 30,
  csv: 20,
  upload: 15,
  telegram: 10,
  discord: 10,
  capture: 0,
};

export function prioritizeNeedsContext<T extends NeedsContextRowLike>(rows: readonly T[]): T[] {
  const eventOf = (row: T): NeedsContextLike => ("ev" in row ? row.ev : row);
  return [...rows].sort((a, b) => {
    const aEvent = eventOf(a);
    const bEvent = eventOf(b);
    const sourceDelta = (AUTO_SOURCE_WEIGHT[bEvent.provider] ?? 5) - (AUTO_SOURCE_WEIGHT[aEvent.provider] ?? 5);
    if (sourceDelta) return sourceDelta;
    const aTime = typeof aEvent.occurredAt === "string" ? Date.parse(aEvent.occurredAt) : aEvent.occurredAt.getTime();
    const bTime = typeof bEvent.occurredAt === "string" ? Date.parse(bEvent.occurredAt) : bEvent.occurredAt.getTime();
    return bTime - aTime;
  });
}

export interface TodaySummaryInput {
  inboxCount: number;
  tests: number;
  decisions: number;
  needsContextCount: number;
}

export interface TodaySummaryItem {
  label: string;
  value: number;
  href: string;
  tone: "action" | "neutral" | "test" | "decision";
}

export function buildTodaySummary(input: TodaySummaryInput): TodaySummaryItem[] {
  return [
    { label: "Need context", value: input.needsContextCount, href: "/app/inbox", tone: "action" },
    { label: "Unlinked evidence", value: input.inboxCount, href: "/app/inbox", tone: "neutral" },
    { label: "Tests this week", value: input.tests, href: "/app/tests", tone: "test" },
    { label: "Decisions this week", value: input.decisions, href: "/app/decisions", tone: "decision" },
  ];
}
