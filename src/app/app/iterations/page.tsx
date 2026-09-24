import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { iterations, subsystems } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { getActiveSeasonAndProject, listSubsystems } from "@/server/evidence";
import { EmptyState, OutcomeBadge, PageHeader, fmtDate } from "@/components/ui";
import { NewIterationForm } from "./new-iteration-form";

export default async function IterationsPage() {
  const ctx = await requireTeam();
  const rows = await db.select({ it: iterations, subsystem: subsystems.name }).from(iterations).leftJoin(subsystems, eq(subsystems.id, iterations.subsystemId)).where(eq(iterations.teamId, ctx.team.id)).orderBy(desc(iterations.openedAt)).limit(200);
  const { project } = await getActiveSeasonAndProject(ctx.team.id);
  const subs = await listSubsystems(ctx.team.id, project?.id);
  const groups = { active: rows.filter((r) => r.it.state !== "closed"), closed: rows.filter((r) => r.it.state === "closed") };
  return (
    <div className="fade-in">
      <PageHeader title="Iterations" subtitle="A meaningful engineering change: problem → change → evidence → test → decision → next step." />
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          {rows.length === 0 ? (
            <EmptyState title="No iterations yet" body="Open one when you begin a change worth remembering. Inbox events can be grouped into an iteration in a single step." />
          ) : (
            (["active", "closed"] as const).map((g) => (
              <section key={g} className="mb-8">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-3">
                  {g} · {groups[g].length}
                </h2>
                <ul className="card divide-y divide-border">
                  {groups[g].map(({ it, subsystem }) => (
                    <li key={it.id}>
                      <Link href={`/app/iterations/${it.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-surface-muted/60">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{it.title}</div>
                          <div className="text-xs text-text-3">
                            {subsystem ?? "No subsystem"} · {fmtDate(it.openedAt)}
                            {it.closedAt ? ` → ${fmtDate(it.closedAt)}` : ""}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <span className="badge">{it.state}</span>
                          {it.outcome ? <OutcomeBadge outcome={it.outcome} /> : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                  {groups[g].length === 0 ? <li className="p-4 text-sm text-text-3">None</li> : null}
                </ul>
              </section>
            ))
          )}
        </div>
        <aside>
          {ctx.canAuthorStudentContent ? (
            <div className="card p-4">
              <h2 className="font-semibold">Open an iteration</h2>
              <NewIterationForm subsystems={subs.map((s) => ({ id: s.id, name: s.name }))} />
            </div>
          ) : (
            <div className="card p-4 text-sm text-text-2">Coaches view iterations; students open them.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
