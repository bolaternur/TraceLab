import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { decisions, iterations, relations, subsystems, tests, users } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { addAnnotation, addRelation } from "@/server/actions";
import { annotationHistory, relativeImprovement } from "@/server/evidence";
import { EvidenceGap, Mono, OutcomeBadge, PageHeader, ProvenanceLabel, TestResult, WhyLink, fmtDate } from "@/components/ui";

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTeam();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [row] = await db.select({ t: tests, subsystem: subsystems.name, author: users.displayName, iteration: iterations.title }).from(tests).leftJoin(subsystems, eq(subsystems.id, tests.subsystemId)).leftJoin(users, eq(users.id, tests.createdBy)).leftJoin(iterations, eq(iterations.id, tests.iterationId)).where(and(eq(tests.id, id), eq(tests.teamId, ctx.team.id))).limit(1);
  if (!row) notFound();
  const t = row.t;
  const notes = await annotationHistory("test", id);
  const linkedDecisions = await db.select({ d: decisions }).from(relations).innerJoin(decisions, eq(decisions.id, relations.fromId)).where(and(eq(relations.teamId, ctx.team.id), eq(relations.toType, "test"), eq(relations.toId, id), eq(relations.fromType, "decision"), eq(relations.status, "accepted")));
  const siblings = t.iterationId ? await db.select().from(tests).where(and(eq(tests.teamId, ctx.team.id), eq(tests.iterationId, t.iterationId), ne(tests.id, id))).orderBy(asc(tests.performedAt)) : [];
  const comparable = siblings.filter((s) => s.trials != null && s.successes != null && t.trials != null && t.successes != null);
  const allDecisions = await db.select({ id: decisions.id, title: decisions.title }).from(decisions).where(eq(decisions.teamId, ctx.team.id)).limit(50);
  const returnTo = `/app/tests/${id}`;
  const pct = t.trials && t.successes != null ? Math.round((t.successes / t.trials) * 100) : null;

  return (
    <div className="fade-in">
      <PageHeader
        title={t.title}
        subtitle={`${row.subsystem ?? "—"} · ${t.targetType}${t.targetLabel ? ` · ${t.targetLabel}` : ""} · ${fmtDate(t.performedAt, true)} · by ${row.author ?? "—"}`}
        actions={
          <>
            <OutcomeBadge outcome={t.outcome} />
            <WhyLink type="test" id={id} />
            {ctx.canAuthorStudentContent ? (
              <Link href={`/app/capture?kind=decision&iteration=${t.iterationId ?? ""}&subsystem=${t.subsystemId ?? ""}`} className="btn btn-sm btn-primary">
                Decide from this test
              </Link>
            ) : null}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <section className="card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Result</h2>
            <div className="mt-2">
              <TestResult trials={t.trials} successes={t.successes} value={t.value} units={t.units} outcome={t.outcome} />
            </div>
            {t.passCriteria ? (
              <p className="mono mt-2 text-xs text-text-2">
                pass criterion: {t.passCriteria}
                {t.metricName ? ` · metric: ${t.metricName}` : ""}
              </p>
            ) : null}
            {comparable.length ? (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Comparison within iteration</h3>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-xs text-text-3">
                    <tr>
                      <th className="py-1 font-medium">Test</th>
                      <th className="py-1 font-medium">Result</th>
                      <th className="py-1 font-medium">Rate</th>
                      <th className="py-1 font-medium">vs this</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...comparable, t].sort((a, b) => a.performedAt.getTime() - b.performedAt.getTime()).map((s) => {
                      const rate = Math.round((s.successes! / s.trials!) * 100);
                      const imp = s.id === id ? null : relativeImprovement({ successes: s.successes!, trials: s.trials! }, { successes: t.successes!, trials: t.trials! });
                      return (
                        <tr key={s.id} className={`border-t border-border ${s.id === id ? "font-medium" : ""}`}>
                          <td className="py-2">{s.id === id ? s.title : <Link href={`/app/tests/${s.id}`} className="text-blueprint">{s.title}</Link>}</td>
                          <td className="mono py-2">
                            {s.successes} / {s.trials}
                          </td>
                          <td className="py-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-24 overflow-hidden rounded-full bg-surface-muted">
                                <div className="h-full bg-blueprint" style={{ width: `${rate}%` }} />
                              </div>
                              <span className="mono text-xs">{rate}%</span>
                            </div>
                          </td>
                          <td className="mono py-2 text-xs">{imp == null ? "—" : `${imp > 0 ? "+" : ""}${imp}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {pct != null && !comparable.length ? <p className="hint mt-2">Add a second quantitative test in the same iteration to see a before/after comparison.</p> : null}
          </section>

          <section className="card p-5 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Experimental design</h2>
            <dl className="mt-2 grid gap-3 sm:grid-cols-2">
              {[
                ["Question", t.question],
                ["Hypothesis", t.hypothesis],
                ["Procedure", t.procedure],
                ["Independent variable", t.independentVariable],
                ["Environment", t.environment],
                ["Observations", t.observations],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <dt className="text-xs text-text-3">{k}</dt>
                  <dd className={v ? "whitespace-pre-wrap" : "text-text-3"}>{v || "Not documented"}</dd>
                </div>
              ))}
            </dl>
          </section>

          {notes.length ? (
            <section className="card p-5 text-sm">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Student notes</h2>
              {notes.map(({ a, author }) => (
                <div key={a.id} className="mt-2 border-l-2 border-teal pl-3">
                  <div className="flex items-center gap-2">
                    <ProvenanceLabel kind={a.provenance} />
                    <Mono>
                      {author ?? "—"} · {fmtDate(a.createdAt, true)}
                    </Mono>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{a.body}</p>
                </div>
              ))}
            </section>
          ) : null}
          {ctx.canAuthorStudentContent ? (
            <form action={addAnnotation} className="card p-4">
              <input type="hidden" name="entityType" value="test" />
              <input type="hidden" name="entityId" value={id} />
              <input type="hidden" name="field" value="note" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <label className="label" htmlFor="note">
                Add a note (student-authored, versioned)
              </label>
              <textarea id="note" name="body" className="textarea" required />
              <button className="btn btn-sm btn-primary mt-2">Save note</button>
            </form>
          ) : null}
        </div>
        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Structural check</h2>
            <ul className="mt-2 space-y-1">
              <EvidenceGap ok={!!t.procedure} label="Procedure documented" />
              <EvidenceGap ok={t.trials != null || t.value != null || t.outcome === "qualitative"} label="Result attached" />
              <EvidenceGap ok={!!t.passCriteria} label="Pass criterion stated" />
              <EvidenceGap ok={!!t.iterationId} label="Linked to an iteration" />
              <EvidenceGap ok={linkedDecisions.length > 0} label="Decision linked" />
            </ul>
            <p className="hint mt-2">Deterministic checks only — nothing here writes content for you.</p>
          </section>
          <section className="card p-4 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Linked</h2>
            {row.iteration ? (
              <p className="mt-2">
                Iteration:{" "}
                <Link href={`/app/iterations/${t.iterationId}`} className="text-blueprint">
                  {row.iteration}
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-text-3">No iteration.</p>
            )}
            {linkedDecisions.length ? (
              <ul className="mt-2 space-y-1">
                {linkedDecisions.map(({ d }) => (
                  <li key={d.id}>
                    Decision:{" "}
                    <Link href={`/app/decisions/${d.id}`} className="text-blueprint">
                      {d.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-text-3">No decision linked yet.</p>
            )}
            {ctx.canAuthorStudentContent && allDecisions.length ? (
              <form action={addRelation} className="mt-3 flex gap-2">
                <input type="hidden" name="fromType" value="decision" />
                <input type="hidden" name="toType" value="test" />
                <input type="hidden" name="toId" value={id} />
                <input type="hidden" name="relationType" value="SUPPORTS" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <select name="fromId" className="select !min-h-8 text-sm" aria-label="Decision">
                  {allDecisions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm">Link</button>
              </form>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
