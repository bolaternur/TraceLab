/** Configuration-driven entitlements. Privacy, export and competition safety are never gated here. */
export const PLANS = {
  free: { name: "Free Team", price: "$0", maxTeams: 1, storageGb: 2, maxSeasons: 2, features: ["Capture & offline", "GitHub integration", "Tests, decisions, timeline", "Deterministic exports"] },
  club: { name: "Club", price: "from $19/mo", maxTeams: 5, storageGb: 25, maxSeasons: Infinity, features: ["Coach dashboard", "Multi-team organization", "Multi-season archive", "Organization policies"] },
  school: { name: "School / Academy", price: "contact", maxTeams: Infinity, storageGb: 200, maxSeasons: Infinity, features: ["SSO-ready", "Retention controls", "Centralized archive", "Organization analytics"] },
} as const;

export type PlanKey = keyof typeof PLANS;

export function isPlan(v: unknown): v is PlanKey {
  return v === "free" || v === "club" || v === "school";
}

export function entitlement(plan: string, key: "coachDashboard" | "multiTeam" | "retentionControls" | "orgAnalytics"): boolean {
  const p: PlanKey = isPlan(plan) ? plan : "free";
  switch (key) {
    case "coachDashboard":
      return true; // coaches always get process visibility; scale features are gated instead
    case "multiTeam":
      return p !== "free";
    case "retentionControls":
      return p === "school";
    case "orgAnalytics":
      return p !== "free";
  }
}

export function canCreateTeam(plan: string, currentTeams: number): boolean {
  const p: PlanKey = isPlan(plan) ? plan : "free";
  return currentTeams < PLANS[p].maxTeams;
}
