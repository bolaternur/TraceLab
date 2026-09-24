import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { aiActionLogs, competitionProfiles, policyVersions } from "@/db/schema";
import { evaluatePolicy, type ActionMatrix, type PolicyAction, type PolicyResult } from "@/modules/policies/engine";
import { policyActorRole, type TeamContext } from "./auth";
import { createHash } from "node:crypto";

export interface ActivePolicy {
  profile: typeof competitionProfiles.$inferSelect | null;
  version: typeof policyVersions.$inferSelect | null;
}

/** Resolve the policy version that governs a team: active first, else the most recent (needs_review/draft). */
export async function loadTeamPolicy(team: TeamContext["team"]): Promise<ActivePolicy> {
  if (!team.competitionProfileId) return { profile: null, version: null };
  const [profile] = await db.select().from(competitionProfiles).where(eq(competitionProfiles.id, team.competitionProfileId)).limit(1);
  if (!profile) return { profile: null, version: null };
  const active = await db
    .select()
    .from(policyVersions)
    .where(and(eq(policyVersions.profileId, profile.id), eq(policyVersions.status, "active")))
    .orderBy(desc(policyVersions.createdAt))
    .limit(1);
  if (active[0]) return { profile, version: active[0] };
  const pending = await db
    .select()
    .from(policyVersions)
    .where(and(eq(policyVersions.profileId, profile.id), inArray(policyVersions.status, ["needs_review", "draft"])))
    .orderBy(desc(policyVersions.createdAt))
    .limit(1);
  return { profile, version: pending[0] ?? null };
}

export interface GateResult extends PolicyResult {
  policy: ActivePolicy;
}

/** Server-side policy gate. UI restrictions are never sufficient; every sensitive action calls this. */
export async function gate(ctx: TeamContext, action: PolicyAction): Promise<GateResult> {
  const policy = await loadTeamPolicy(ctx.team);
  const status = (policy.version?.status as "active" | "needs_review" | "draft" | "superseded" | undefined) ?? "none";
  const result = evaluatePolicy({
    action,
    matrix: policy.version ? (policy.version.actionMatrix as ActionMatrix) : null,
    policyStatus: status === "superseded" ? "needs_review" : status,
    studentOwnedMode: ctx.team.studentOwnedMode,
    strictProfile: policy.profile?.strict ?? false,
    actorRole: policyActorRole(ctx),
  });
  return { ...result, policy };
}

export async function logAiAction(params: {
  ctx: TeamContext;
  action: PolicyAction;
  gate: GateResult;
  referencedEntities: Array<{ type: string; id: string }>;
  provider?: string | null;
  model?: string | null;
  prompt?: string | null;
  output?: string | null;
  disposition?: "pending" | "accepted" | "rejected" | "blocked";
}) {
  const output = params.output ?? null;
  const [row] = await db
    .insert(aiActionLogs)
    .values({
      teamId: params.ctx.team.id,
      userId: params.ctx.user.id,
      action: params.action,
      policyVersionId: params.gate.policy.version?.id ?? null,
      policyDecision: params.gate.decision,
      referencedEntities: params.referencedEntities,
      provider: params.provider ?? null,
      model: params.model ?? null,
      prompt: params.prompt ?? null,
      output,
      outputHash: output ? createHash("sha256").update(output).digest("hex") : null,
      disposition: params.disposition ?? (params.gate.allowed ? "pending" : "blocked"),
    })
    .returning();
  return row;
}
