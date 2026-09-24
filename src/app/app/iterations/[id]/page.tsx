import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, decisions, iterations, relations, sourceEvents, subsystems, tests, users } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { addAnnotation, addRelation, resolveSuggestion, updateIteration } from "@/server/actions";
import { annotationHistory, relativeImprovement, testResultLabel } from "@/server/evidence";
import { DecisionState, Mono, OutcomeBadge, PageHeader, ProvenanceLabel, SourceBadge, TestResult, WhyLink, fmtDate } from "@/components/ui";

export default async function IterationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireTeam();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [it] = await db.select({ it: iterations, subsystem: subsystems.name, creator: users.displayName }).from(iterations).leftJoin(subsystems, eq(subsystems.id, iterations.subsystemId)).leftJoin(users, eq(users.id, iterations.createdBy)).where(and(eq(iterations.id, id), eq(iterations.teamId, ctx.team.id))).limit(1);
  if (!it) notFound();
  const evs = await db.select({ ev: sourceEvents, artifact: artifacts, actor: users.displayName }).from(sourceEvents).leftJoin(artifacts, eq(artifacts.sourceEventId, sourceEvents.id)).leftJoin(users, eq(users.id, sourceEvents.actorUserId)).where(and(eq(sourceEvents.teamId, ctx.team.id), eq(sourceEvents.iterationId, id))).orderBy(asc(sourceEvents.occurredAt));
  const ts = await db.select().from(tests).where(and(eq(tests.teamId, ctx.team.id), eq(tests.iterationId, id))).orderBy(asc(tests.performedAt));
  const ds = await db.select().from(decisions).where(and(eq(decisions.teamId, ctx.team.id), eq(decisions.iterationId, id))).orderBy(asc(decisions.decidedAt));
  const notes = await annotationHistory("iteration", id);
  const latest = new Map<string, (typeof notes)[number]>();
  for (const n of notes) if (!latest.has(n.a.field)) latest.set(n.a.field, n);
  const rels = await db.select().from(relations).where(and(eq(relations.teamId, ctx.team.id), or(eq(relations.fromId, id), eq(relations.toId, id))));
  const suggested = rels.filter((r) => r.status === "suggested");
  const relatedIds = suggested.map((r) => (r.fromId === id ? r.toId : r.fromId));
  const related = relatedIds.length ? await db.select().from(iterations).where(and(eq(iterations.teamId, ctx.team.id), inArray(iterations.id, relatedIds))) : [];
  const unlinkedTests = await db.select({ id: tests.id, title: tests.title }).from(tests).where(and(eq(tests.teamId, ctx.team.id), or(eq(tests.iterationId, id), isNull(tests.iterationId)))).limit(50);
  const decisionRationales = ds.length ? await Promise.all(ds.map((d) => annotationHistory("decision", d.id))) : [];
  const quant = ts.filter((t) => t.trials != null && t.successes != null);
  const improvement = quant.length >= 2 ? relativeImprovement({ successes: quant[0].successes!, trials: quant[0].trials! }, { successes: quant[quant.length - 1].successes!, trials: quant[quant.length - 1].trials! }) : null;
  const contributors = [...new Set(evs.map((e) => e.actor).filter(Boolean))];
  const returnTo = `/app/iterations/${id}`;

  return (
    <div className="fade-in">
      <PageHeader
        title={it.it.title}
        subtitle={`${it.subsystem ?? "No subsystem"} · opened ${fmtDate(it.it.openedAt)} by ${it.creator ?? "—"}${it.it.closedAt ? ` · closed ${fmtDate(it.it.closedAt)}` : ""}${contributors.length ? ` · contributors: ${contributors.join(", ")}` : ""}`}
        actions={
          <>
            <span className="badge self-center">{it.it.state}</span>
            {it.it.outcome ? <OutcomeBadge outcome={it.it.outcome} /> : null}
            <WhyLink type="iteration" id={id} />
            {ctx.canAuthorStudentContent ? (
              <>
                <Link href={`/app/capture?kind=test&iteration=${id}&subsystem=${it.it.subsystemId ?? ""}`} className="btn btn-sm">
                  + Test
                </Link>
                <Link href={`/app/capture?kind=decision&iteration=${id}&subsystem=${it.it.subsystemId ?? ""}`} className="btn btn-sm btn-primary">
                  + Decision
                </Link>
              </>
            ) : null}
          </>
        }
      />

      {related.length ? (
        <div className="card mb-6 border-warning/50 p-4">
          <div className="flex items-center gap-2">
            <ProvenanceLabel kind="suggestion" />
            <span className="font-medium">We may already have tried this</span>
          </div>
          <ul className="mt-2 space-y-2 text-sm">
            {related.map((r) => {
              const rel = suggested.find((s) => s.fromId === r.id || s.toId === r.id)!;
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/app/iterations/${r.id}`} className="text-blueprint">
                    {r.title}
                  </Link>
                  <span className="flex items-center gap-1">
                    <OutcomeBadge outcome={r.outcome} />
                    <Mono>{fmtDate(r.openedAt)}</Mono>
                    <form action={resolveSuggestion} className="flex gap-1">
                      <input type="hidden" name="id" value={rel.id} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button name="status" value="accepted" className="btn btn-sm">
                        Related
                      </button>
                      <button name="status" value="rejected" className="btn btn-sm">
                        Not related
                      </button>
                    </form>
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="hint mt-2">Engineering context changes — a past conclusion is a starting point, not a verdict.</p>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {(["problem", "change", "rationale", "next_step"] as const).map((field) => {
            const n = latest.get(field);
            const label = { problem: "Problem / goal", change: "What changed", rationale: "Why (student rationale)", next_step: "Next step" }[field];
            return (
              <section key={field} className="card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">{label}</h2>
                  {n ? (
                    <span className="flex items-center gap-2">
                      <ProvenanceLabel kind={n.a.provenance} />
                      <Mono>
                        {n.author ?? "—"} · {fmtDate(n.a.createdAt, true)}
                        {n.a.supersedesId ? " · revised" : ""}
                      </Mono>
                    </span>
                  ) : null}
                </div>
                {n ? <p className="mt-2 whitespace-pre-wrap text-sm">{n.a.body}</p> : <p className="mt-2 text-sm text-text-3">Not documented yet.</p>}
                {ctx.canAuthorStudentContent ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-blueprint">{n ? "Revise (keeps history)" : "Write"}</summary>
                    <form action={addAnnotation} className="mt-2 space-y-2">
                      <input type="hidden" name="entityType" value="iteration" />
                      <input type="hidden" name="entityId" value={id} />
                      <input type="hidden" name="field" value={field} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <textarea name="body" className="textarea" required aria-label={label} />
                      <button className="btn btn-sm btn-primary">Save</button>
                    </form>
                  </details>
                ) : null}
              </section>
            );
          })}

          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Test results</h2>
            {ts.length === 0 ? <p className="mt-2 text-sm text-text-3">No test linked yet.</p> : null}
            <ul className="mt-2 divide-y divide-border">
              {ts.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <Link href={`/app/tests/${t.id}`} className="font-medium hover:underline">
                      {t.title}
                    </Link>
                    <div className="mono text-[11px] text-text-3">
                      {t.targetLabel ?? t.targetType} · {fmtDate(t.performedAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <TestResult trials={t.trials} successes={t.successes} value={t.value} units={t.units} outcome={t.outcome} />
                    <OutcomeBadge outcome={t.outcome} />
                  </div>
                </li>
              ))}
            </ul>
            {improvement != null ? (
              <p className="mono mt-2 text-sm">
                {improvement > 0 ? "+" : ""}
                {improvement}% relative change ({testResultLabel(quant[0])} → {testResultLabel(quant[quant.length - 1])}) <span className="text-text-3">· system-computed</span>
              </p>
            ) : null}
            {ctx.canAuthorStudentContent && unlinkedTests.length ? (
              <form action={addRelation} className="mt-3 flex flex-wrap gap-2">
                <input type="hidden" name="fromType" value="test" />
                <input type="hidden" name="toType" value="iteration" />
                <input type="hidden" name="toId" value={id} />
                <input type="hidden" name="relationType" value="TESTS" />
                <input type="hidden" name="returnTo" value={returnTo} />
                <select name="fromId" className="select !min-h-8 !w-auto text-sm" aria-label="Test to link">
                  {unlinkedTests.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm">Link existing test</button>
              </form>
            ) : null}
          </section>

          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Decisions</h2>
            {ds.length === 0 ? <p className="mt-2 text-sm text-text-3">No decision recorded. Evidence link missing.</p> : null}
            <ul className="mt-2 space-y-3">
              {ds.map((d, i) => {
                const r = decisionRationales[i]?.find((x) => x.a.field === "rationale");
                return (
                  <li key={d.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{d.title}</span>
                      <span className="flex items-center gap-2">
                        <DecisionState disposition={d.disposition} />
                        <Mono>{fmtDate(d.decidedAt)}</Mono>
                        <WhyLink type="decision" id={d.id} />
                      </span>
                    </div>
                    {r ? (
                      <blockquote className="mt-2 border-l-2 border-teal pl-3 text-sm">
                        {r.a.body}
                        <div className="mt-1">
                          <ProvenanceLabel kind="student" />
                        </div>
                      </blockquote>
                    ) : null}
                    {(d.alternatives as string[]).length ? <p className="mt-2 text-xs text-text-2">Alternatives: {(d.alternatives as string[]).join(" · ")}</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          {ctx.canAuthorStudentContent && it.it.state !== "closed" ? (
            <form action={updateIteration} className="card flex flex-wrap items-end gap-2 p-4">
              <input type="hidden" name="id" value={id} />
              <label className="block">
                <span className="label">State</span>
                <select name="state" className="select !w-auto" defaultValue={it.it.state}>
                  {["open", "testing", "deciding", "closed"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Outcome (if closing)</span>
                <select name="outcome" className="select !w-auto" defaultValue="">
                  <option value="">—</option>
                  {["kept", "reverted", "rejected", "deferred"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <button className="btn">Update</button>
            </form>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Evidence rail</h2>
            {evs.length === 0 ? (
              <p className="mt-2 text-sm text-text-3">
                No source evidence linked.{" "}
                <Link href="/app/inbox" className="text-blueprint">
                  Link from Inbox
                </Link>
              </p>
            ) : (
              <ol className="timeline-rail mt-3 space-y-3 pl-6">
                {evs.map(({ ev, artifact, actor }) => (
                  <li key={ev.id} className="relative text-sm">
                    <span aria-hidden className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-blueprint bg-surface" />
                    <div className="flex flex-wrap items-center gap-1">
                      <SourceBadge provider={ev.provider} eventType={ev.eventType} />
                      <Mono>{fmtDate(ev.occurredAt, true)}</Mono>
                    </div>
                    <Link href={`/app/inbox?status=linked&event=${ev.id}`} className="mt-1 block hover:underline">
                      {ev.title}
                    </Link>
                    {artifact?.storageKey ? <img src={`/api/media/${artifact.id}`} alt={ev.title} className="mt-1 max-h-40 rounded border border-border object-cover" /> : null}
                    <div className="text-[11px] text-text-3">{actor ?? ev.actorExternalId ?? ""}</div>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {notes.length > 0 ? (
            <section className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">History</h2>
              <ul className="mt-2 space-y-1 text-xs text-text-2">
                {notes.map(({ a, author }) => (
                  <li key={a.id}>
                    <Mono>{fmtDate(a.createdAt, true)}</Mono> {author ?? "—"} wrote <em>{a.field}</em>
                    {a.supersedesId ? " (revision)" : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {ctx.isCoach && !ctx.canAuthorStudentContent ? (
            <form action={addAnnotation} className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Coach note</h2>
              <p className="hint mt-1">Stored separately; never edits student content.</p>
              <input type="hidden" name="entityType" value="iteration" />
              <input type="hidden" name="entityId" value={id} />
              <input type="hidden" name="field" value="coach_note" />
              <input type="hidden" name="returnTo" value={returnTo} />
              <textarea name="body" className="textarea mt-2" required aria-label="Coach note" />
              <button className="btn btn-sm mt-2">Add note</button>
            </form>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

