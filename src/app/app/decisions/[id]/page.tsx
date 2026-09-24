import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { annotations, decisions, iterations, relations, sourceEvents, subsystems, tests, users } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { addAnnotation, addRelation } from "@/server/actions";
import { DecisionState, Mono, PageHeader, ProvenanceLabel, SourceBadge, fmtDate } from "@/components/ui";
import { TraceIcon } from "@/components/tracelab/trace-icon";

const relationLabel: Record<string, string> = {
  SUPPORTS: "supports",
  CONTRADICTS: "contradicts",
  SUPERSEDES: "supersedes",
  LEADS_TO: "changed because of",
  REFERENCES: "references",
  RELATED_TO: "related to",
  DERIVED_FROM: "source",
};

export default async function DecisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTeam();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const [row] = await db
    .select({ d: decisions, subsystem: subsystems.name, author: users.displayName, iteration: iterations.title })
    .from(decisions)
    .leftJoin(subsystems, eq(subsystems.id, decisions.subsystemId))
    .leftJoin(users, eq(users.id, decisions.authorUserId))
    .leftJoin(iterations, eq(iterations.id, decisions.iterationId))
    .where(and(eq(decisions.id, id), eq(decisions.teamId, ctx.team.id)))
    .limit(1);
  if (!row) notFound();

  const [rationaleRows, rels, allTests] = await Promise.all([
    db
      .select({ a: annotations, author: users.displayName })
      .from(annotations)
      .leftJoin(users, eq(users.id, annotations.authorUserId))
      .where(and(eq(annotations.teamId, ctx.team.id), eq(annotations.entityType, "decision"), eq(annotations.entityId, id), eq(annotations.field, "rationale")))
      .orderBy(desc(annotations.createdAt)),
    db.select().from(relations).where(and(eq(relations.teamId, ctx.team.id), eq(relations.fromType, "decision"), eq(relations.fromId, id), eq(relations.status, "accepted"))),
    db.select({ id: tests.id, title: tests.title, outcome: tests.outcome, performedAt: tests.performedAt }).from(tests).where(eq(tests.teamId, ctx.team.id)).orderBy(desc(tests.performedAt)).limit(80),
  ]);

  const testIds = rels.filter((relation) => relation.toType === "test").map((relation) => relation.toId);
  const sourceIds = rels.filter((relation) => relation.toType === "source_event").map((relation) => relation.toId);
  const [linkedTests, linkedSources] = await Promise.all([
    testIds.length ? db.select().from(tests).where(and(eq(tests.teamId, ctx.team.id), inArray(tests.id, testIds))) : Promise.resolve([]),
    sourceIds.length ? db.select().from(sourceEvents).where(and(eq(sourceEvents.teamId, ctx.team.id), inArray(sourceEvents.id, sourceIds))) : Promise.resolve([]),
  ]);
  const testById = new Map(linkedTests.map((test) => [test.id, test]));
  const sourceById = new Map(linkedSources.map((event) => [event.id, event]));
  const latestRationale = rationaleRows[0];
  const returnTo = `/app/decisions/${id}`;

  return (
    <div className="fade-in">
      <PageHeader
        title={row.d.title}
        subtitle={`Decision · ${row.subsystem ?? "Unassigned subsystem"} · ${fmtDate(row.d.decidedAt, true)}`}
        actions={
          <>
            <DecisionState disposition={row.d.disposition} />
            <Link href={`/app/why/decision/${id}`} className="btn btn-sm">Why?</Link>
            {row.d.iterationId ? <Link href={`/app/iterations/${row.d.iterationId}`} className="btn btn-sm">Open iteration</Link> : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="evidence-card p-5" data-tone="decision">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="trace-meta text-[10px] uppercase text-text-3">Decision · {row.d.id.slice(0, 8)}</div>
                <h2 className="mt-1 text-lg font-semibold">Student-authored rationale</h2>
              </div>
              <ProvenanceLabel kind="student" />
            </div>
            {latestRationale ? (
              <blockquote className="mt-4 border-l-2 border-decision pl-4 text-[15px] leading-7 text-ink">
                {latestRationale.a.body}
                <footer className="mt-3 flex flex-wrap items-center gap-2">
                  <Mono>{latestRationale.author ?? row.author ?? "—"} · {fmtDate(latestRationale.a.createdAt, true)}</Mono>
                  {latestRationale.a.supersedesId ? <span className="badge">revised</span> : null}
                </footer>
              </blockquote>
            ) : (
              <div className="mt-4 rounded-[16px] border border-dashed border-border px-4 py-4 text-sm text-text-3">
                The decision exists, but its human rationale is missing. Add the why before treating this as complete engineering memory.
              </div>
            )}

            {ctx.canAuthorStudentContent ? (
              <form action={addAnnotation} className="mt-5 border-t border-border pt-4">
                <input type="hidden" name="entityType" value="decision" />
                <input type="hidden" name="entityId" value={id} />
                <input type="hidden" name="field" value="rationale" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <label className="label" htmlFor="decision-rationale">{latestRationale ? "Revise rationale" : "Add rationale"} (student-authored, versioned)</label>
                <textarea id="decision-rationale" name="body" className="textarea" required defaultValue={latestRationale?.a.body ?? ""} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="hint">Saving creates a new annotation version; the original remains in history.</span>
                  <button className="btn btn-sm btn-primary">Save rationale</button>
                </div>
              </form>
            ) : null}
          </section>

          <section className="card p-5">
            <div className="flex items-center gap-2">
              <TraceIcon name="test" size={18} className="text-test" />
              <h2 className="font-semibold">Supported by</h2>
            </div>
            {rels.length ? (
              <ul className="mt-3 space-y-2">
                {rels.map((relation) => {
                  const linkedTest = relation.toType === "test" ? testById.get(relation.toId) : null;
                  const linkedSource = relation.toType === "source_event" ? sourceById.get(relation.toId) : null;
                  const href = linkedTest ? `/app/tests/${linkedTest.id}` : linkedSource ? `/app/inbox?status=linked&event=${linkedSource.id}` : relation.toType === "iteration" ? `/app/iterations/${relation.toId}` : `/app/graph?focus=${id}`;
                  return (
                    <li key={relation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-border bg-canvas px-3.5 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="badge badge-decision">{relationLabel[relation.relationType] ?? relation.relationType.toLowerCase()}</span>
                          {linkedSource ? <SourceBadge provider={linkedSource.provider} eventType={linkedSource.eventType} /> : null}
                        </div>
                        <div className="mt-1 font-semibold">{linkedTest?.title ?? linkedSource?.title ?? relation.toType.replace("_", " ")}</div>
                        {linkedTest ? <Mono>{linkedTest.outcome} · {fmtDate(linkedTest.performedAt)}</Mono> : linkedSource ? <Mono>{fmtDate(linkedSource.occurredAt, true)}</Mono> : null}
                      </div>
                      <Link href={href} className="text-sm font-semibold text-blueprint">Open evidence →</Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-text-3">No supporting evidence is linked yet. This is an evidence gap, not a judgment about the decision.</p>
            )}

            {ctx.canAuthorStudentContent && allTests.length ? (
              <form action={addRelation} className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
                <input type="hidden" name="fromType" value="decision" />
                <input type="hidden" name="fromId" value={id} />
                <input type="hidden" name="toType" value="test" />
                <input type="hidden" name="relationType" value="SUPPORTS" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <select name="toId" className="select flex-1" aria-label="Supporting test">
                  {allTests.map((test) => <option key={test.id} value={test.id}>{test.title} · {test.outcome}</option>)}
                </select>
                <button className="btn">Link test</button>
              </form>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold">Result / what changed next</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[14px] border border-border bg-canvas p-3">
                <div className="trace-meta text-[9px] uppercase text-text-3">Disposition</div>
                <div className="mt-2"><DecisionState disposition={row.d.disposition} /></div>
              </div>
              <div className="rounded-[14px] border border-border bg-canvas p-3">
                <div className="trace-meta text-[9px] uppercase text-text-3">Iteration</div>
                <div className="mt-1 text-sm font-semibold">{row.iteration ?? "No iteration linked"}</div>
              </div>
            </div>
            {(row.d.alternatives as string[]).length ? (
              <div className="mt-4">
                <div className="trace-meta text-[9px] uppercase text-text-3">Alternatives considered</div>
                <ul className="mt-2 flex flex-wrap gap-2">{(row.d.alternatives as string[]).map((alternative) => <li key={alternative} className="badge">{alternative}</li>)}</ul>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Authored by</h2>
            <div className="mt-2 text-sm font-semibold">{row.author ?? "Unknown student"}</div>
            <Mono>{fmtDate(row.d.decidedAt, true)}</Mono>
          </section>

          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Source history</h2>
            <p className="mt-2 text-sm leading-6 text-text-2">Rationale versions and linked source artifacts remain separate from the immutable decision record.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href={`/app/why/decision/${id}`} className="btn btn-sm">View Why? history</Link>
              <Link href={`/app/graph?focus=${id}`} className="btn btn-sm">Open trace</Link>
            </div>
            {rationaleRows.length > 1 ? <p className="hint mt-2">{rationaleRows.length} rationale versions preserved.</p> : null}
          </section>

          <section className="rounded-[18px] border border-border bg-canvas p-4">
            <div className="trace-meta text-[9px] uppercase text-text-3">Trust</div>
            <ul className="mt-2 space-y-2 text-sm text-text-2">
              <li className="flex gap-2"><span className="text-success" aria-hidden>✓</span> Student-authored text remains versioned.</li>
              <li className="flex gap-2"><span className="text-success" aria-hidden>✓</span> Evidence links are explicit relations.</li>
              <li className="flex gap-2"><span className="text-success" aria-hidden>✓</span> AI does not silently alter this rationale.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
