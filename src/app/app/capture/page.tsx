import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { iterations, tests } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { getActiveSeasonAndProject, listSubsystems } from "@/server/evidence";
import { CaptureSheet } from "./capture-sheet";
import { PageHeader, Notice } from "@/components/ui";
import { TraceIcon } from "@/components/tracelab/trace-icon";

export default async function CapturePage({ searchParams }: { searchParams: Promise<{ kind?: string; iteration?: string; subsystem?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTeam();
  const { project } = await getActiveSeasonAndProject(ctx.team.id);
  const subs = await listSubsystems(ctx.team.id, project?.id);
  const openIts = await db.select({ id: iterations.id, title: iterations.title }).from(iterations).where(and(eq(iterations.teamId, ctx.team.id), inArray(iterations.state, ["open", "testing", "deciding"]))).orderBy(desc(iterations.openedAt)).limit(30);
  const recentTests = await db.select({ id: tests.id, title: tests.title }).from(tests).where(eq(tests.teamId, ctx.team.id)).orderBy(desc(tests.performedAt)).limit(30);
  return (
    <div className="mx-auto w-full max-w-[820px] pb-24 sm:pb-10">
      <PageHeader
        title="Capture evidence"
        subtitle="Capture now, enrich later. The project and season are attached automatically, and offline work stays visible instead of disappearing."
        actions={
          <div className="trace-chip min-h-10 gap-2 px-3 text-xs text-text-2">
            <TraceIcon name="offline" size={15} />
            Saved on this device first
          </div>
        }
      />
      {!ctx.canAuthorStudentContent ? (
        <Notice tone="warning">Coaches can view evidence but do not create student captures. Ask a student to record this observation.</Notice>
      ) : (
        <CaptureSheet
          teamId={ctx.team.id}
          subsystems={subs.map((s) => ({ id: s.id, name: s.name }))}
          iterations={openIts}
          tests={recentTests}
          initialKind={sp.kind}
          initialIteration={sp.iteration}
          initialSubsystem={sp.subsystem}
        />
      )}
    </div>
  );
}
