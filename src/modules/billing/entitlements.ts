/** Compatibility for archived plan labels. All active features are free. Limits protect capacity, not payment. */
const freeAccess = { name: "Iznera — free", price: "$0", maxTeams: 20, storageGb: 2, maxSeasons: Infinity, features: ["Capture & offline", "Team evidence", "Tests, decisions, timeline", "Deterministic exports"] } as const;
export const PLANS = {
  free: freeAccess,
  club: freeAccess,
  school: freeAccess,
} as const;

export type PlanKey = keyof typeof PLANS;

export function isPlan(v: unknown): v is PlanKey {
  return v === "free" || v === "club" || v === "school";
}

export function entitlement(_plan: string, _key: "coachDashboard" | "multiTeam" | "retentionControls" | "orgAnalytics"): boolean {
  return true;
}

export function canCreateTeam(plan: string, currentTeams: number): boolean {
  const p: PlanKey = isPlan(plan) ? plan : "free";
  return currentTeams < PLANS[p].maxTeams;
}
