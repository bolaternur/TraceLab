import type { ReactNode } from "react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { annotations, seasons } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { seasonHandoff, testResultLabel } from "@/server/evidence";
import { completeHandoff, curateHandoff, startNewSeason } from "@/server/actions";
import { track } from "@/server/audit";
import { DecisionState, EmptyState, Mono, OutcomeBadge, PageHeader, ProvenanceLabel, fmtDate } from "@/components/ui";

export default async function HandoffPage({ searchParams }: { searchParams: Promise<{ season?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTeam();
  const all = await db.select().from(seasons).where(eq(seasons.teamId, ctx.team.id)).orderBy(desc(seasons.year));
  const season = all.find((s) => s.id === sp.season) ?? all.find((s) => s.isActive) ?? all[0];
  if (!season) return <EmptyState title="No season" body="Create a season to build a handoff." />;
  const sections = await seasonHandoff(ctx.team.id, season.id);
  await track("handoff.opened", { teamId: ctx.team.id, userId: ctx.user.id });
  const handoffNotes = await db.select().from(annotations).where(eq(annotations.teamId, ctx.team.id)).orderBy(desc(annotations.createdAt));
  const noteFor = (subsystemId: string) => handoffNotes.find((n) => n.entityType === "subsystem" && n.entityId === subsystemId && n.field === "handoff");
  return (
    <div className="fade-in">
      <PageHeader
        title={`${season.name} — Start here next season`}
        subtitle="Start here next season: major decisions, known failures, proven tests, unresolved questions and subsystem history — all derived from existing evidence. Nothing is invented; students curate the narrative."
        actions={
          <>
            <div className="flex gap-1 text-sm">
              {all.map((s) => (
                <Link key={s.id} href={`/app/handoff?season=${s.id}`} className={`rounded-md border px-3 py-1 ${s.id === season.id ? "border-blueprint bg-blueprint-bg text-blueprint" : "border-border"}`}>
                  {s.year}
                </Link>
              ))}
            </div>
            <Link href="/app/exports" className="btn btn-sm">
              Export handoff
            </Link>
          </>
        }
      />
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
        <div>
          Status:{" "}
          {season.handoffCompletedAt ? (
            <span className="badge badge-success">completed {fmtDate(season.handoffCompletedAt)}</span>
          ) : (
            <span className="badge badge-warning">in progress</span>
          )}
          <span className="ml-3 text-text-3">
            {sections.filter((s) => noteFor(s.subsystem.id)).length} / {sections.length} subsystems have a student “start here” note
          </span>
        </div>
        {ctx.canOrganize && !season.handoffCompletedAt ? (
          <form action={completeHandoff}>
            <input type="hidden" name="seasonId" value={season.id} />
            <button className="btn btn-sm btn-primary">Mark handoff complete</button>
          </form>
        ) : null}
      </div>

      {sections.length === 0 ? <EmptyState title="No subsystems in this season" body="Add subsystems from the engineering timeline or project setup." /> : null}
      <div className="space-y-6">
        {sections.map((s) => {
          const note = noteFor(s.subsystem.id);
          return (
            <section key={s.subsystem.id} className="card p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{s.subsystem.name}</h2>
                <Link href={`/app/timeline?subsystem=${s.subsystem.id}`} className="text-sm text-blueprint">
                  Open in timeline →
                </Link>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <Block title="Key decisions">
                  {s.keyDecisions.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <Link href={`/app/decisions/${d.id}`} className="hover:underline">
                        {d.title}
                      </Link>
                      <DecisionState disposition={d.disposition} />
                    </li>
                  ))}
                </Block>
                <Block title="Known failures">
                  {s.failed.map((i) => (
                    <li key={i.id} className="flex items-center justify-between gap-2">
                      <Link href={`/app/iterations/${i.id}`} className="hover:underline">
                        {i.title}
                      </Link>
                      <OutcomeBadge outcome={i.outcome} />
                    </li>
                  ))}
                </Block>
                <Block title="Important tests">
                  {s.importantTests.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2">
                      <Link href={`/app/tests/${t.id}`} className="hover:underline">
                        {t.title}
                      </Link>
                      <Mono>{testResultLabel(t)}</Mono>
                    </li>
                  ))}
                </Block>
                <Block title="Unresolved questions">
                  {s.open.map((i) => (
                    <li key={i.id}>
                      <Link href={`/app/iterations/${i.id}`} className="hover:underline">
                        {i.title}
                      </Link>{" "}
                      <span className="badge">{i.state}</span>
                    </li>
                  ))}
                </Block>
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Start here next season · student-curated</h3>
                {note ? (
                  <blockquote className="mt-2 border-l-2 border-teal pl-3 text-sm">
                    {note.body}
                    <div className="mt-1 flex items-center gap-2">
                      <ProvenanceLabel kind="student" />
                      <Mono>{fmtDate(note.createdAt)}</Mono>
                    </div>
                  </blockquote>
                ) : (
                  <p className="mt-1 text-sm text-text-3">Not written yet.</p>
                )}
                {ctx.canAuthorStudentContent ? (
                  <form action={curateHandoff} className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="seasonId" value={season.id} />
                    <input type="hidden" name="subsystemId" value={s.subsystem.id} />
                    <textarea name="body" className="textarea flex-1 !min-h-16" placeholder="What should next year's team know first about this subsystem?" required aria-label={`Handoff note for ${s.subsystem.name}`} />
                    <button className="btn self-start">Save</button>
                  </form>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>

      {ctx.canOrganize ? (
        <details className="card mt-8 p-4 text-sm">
          <summary className="cursor-pointer font-medium">Start a new season</summary>
          <p className="hint mt-1">Archives the current season, creates a new project and carries subsystem names forward. Past evidence stays linked and searchable.</p>
          <form action={startNewSeason} className="mt-3 flex flex-wrap gap-2">
            <input name="name" className="input !w-40" placeholder="2027 Season" required />
            <input name="year" type="number" className="input mono !w-28" defaultValue={season.year + 1} required />
            <input name="projectName" className="input !w-48" placeholder="Project / robot name" required />
            <button className="btn btn-primary">Create season</button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">{title}</h3>
      <ul className="mt-1 space-y-1 text-sm">{children.length ? children : <li className="text-text-3">None documented</li>}</ul>
    </div>
  );
}
