import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { decisions, subsystems, tests } from "@/db/schema";
import { WorkbenchShell } from "@/components/workbench/workbench-shell";
import { buildWorkbenchSnapshot } from "@/components/workbench/snapshot";
import { requireTeam } from "@/server/auth";
import { getActiveSeasonAndProject, listSubsystems, thisWeek } from "@/server/evidence";
import { loadTeamPolicy } from "@/server/policy";

export default async function WorkbenchPage() {
  const ctx = await requireTeam();
  const [week, active, policy, recentTests, recentDecisions] = await Promise.all([
    thisWeek(ctx.team.id),
    getActiveSeasonAndProject(ctx.team.id),
    loadTeamPolicy(ctx.team),
    db.select({ t: tests, subsystem: subsystems.name }).from(tests).leftJoin(subsystems, eq(subsystems.id, tests.subsystemId)).where(eq(tests.teamId, ctx.team.id)).orderBy(desc(tests.performedAt)).limit(4),
    db.select({ d: decisions, subsystem: subsystems.name }).from(decisions).leftJoin(subsystems, eq(subsystems.id, decisions.subsystemId)).where(eq(decisions.teamId, ctx.team.id)).orderBy(desc(decisions.decidedAt)).limit(4),
  ]);

  const captureSubsystems = await listSubsystems(ctx.team.id, active.project?.id ?? null);

  const snapshot = buildWorkbenchSnapshot({
    team: ctx.team,
    season: active.season,
    project: active.project ? { id: active.project.id, title: active.project.name } : null,
    policy: { status: policy.version?.status ?? null, strict: policy.profile?.strict ?? false },
    week,
    recentTests,
    recentDecisions,
  });

  const captureOptions = {
    teamId: ctx.team.id,
    canAuthorStudentContent: ctx.canAuthorStudentContent,
    subsystems: captureSubsystems.map((subsystem) => ({ id: subsystem.id, name: subsystem.name })),
    iterations: week.activeIterations.map(({ it }) => ({ id: it.id, title: it.title })),
    tests: recentTests.map(({ t }) => ({ id: t.id, title: t.title })),
  };

  return <WorkbenchShell snapshot={snapshot} captureOptions={captureOptions} />;
}
