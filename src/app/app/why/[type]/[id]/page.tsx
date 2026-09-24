import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeam } from "@/server/auth";
import { explainWhy, testResultLabel, type EntityType } from "@/server/evidence";
import { track } from "@/server/audit";
import { DecisionState, Mono, OutcomeBadge, PageHeader, ProvenanceLabel, SourceBadge, fmtDate } from "@/components/ui";

export default async function WhyPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const { type, id } = await params;
  const ctx = await requireTeam();
  if (!["iteration", "test", "decision", "source_event"].includes(type) || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const why = await explainWhy(ctx.team.id, type as EntityType, id);
  if (!why) notFound();
  await track("memory.why_opened", { teamId: ctx.team.id, userId: ctx.user.id, props: { type } });
  const keep = why.decisions.find((d) => d.disposition === "keep") ?? why.decisions[0] ?? null;
  const rationale = why.rationale.filter((r) => r.a.field === "rationale");
  return (
    <div className="fade-in mx-auto max-w-3xl">
      <PageHeader title="Why?" subtitle={`Deterministic answer assembled from linked evidence for “${why.title}”. No generative AI is used on this page.`} />
      <article className="card p-6">
        {keep ? (
          <p className="text-lg">
            <strong>{keep.title}</strong> was {keep.disposition === "keep" ? "selected" : keep.disposition === "reject" ? "rejected" : `marked “${keep.disposition}”`}
            {why.tests.length ? ` after ${why.tests.length === 1 ? `Test “${why.tests[0].title}”` : `${why.tests.length} tests`}` : ""} on {fmtDate(keep.decidedAt)}.
          </p>
        ) : (
          <p className="text-lg text-text-2">No decision is linked to this yet — the “why” is not documented.</p>
        )}

        {why.comparison ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[why.comparison.before, why.comparison.after].map((t, i) => (
              <div key={t.id} className="rounded-md border border-border p-3">
                <div className="mono text-xs text-text-3">{i === 0 ? "before" : "after"} · {t.targetLabel ?? t.title}</div>
                <div className="mono mt-1 text-2xl font-semibold">{testResultLabel(t)}</div>
                <OutcomeBadge outcome={t.outcome} />
              </div>
            ))}
            {why.comparison.improvement != null ? (
              <p className="mono col-span-2 text-sm">
                {why.comparison.improvement > 0 ? "+" : ""}
                {why.comparison.improvement}% relative change <span className="text-text-3">· system-computed from recorded trials</span>
              </p>
            ) : null}
          </div>
        ) : null}

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Student rationale</h2>
          {rationale.length === 0 ? (
            <p className="mt-2 text-sm text-text-3">Not documented.</p>
          ) : (
            rationale.map((r) => (
              <blockquote key={r.a.id} className="mt-2 border-l-2 border-teal pl-3 text-sm">
                “{r.a.body}”
                <div className="mt-1 flex items-center gap-2">
                  <ProvenanceLabel kind="student" />
                  <Mono>
                    {r.author ?? "—"} · {fmtDate(r.a.createdAt)} · on {r.a.entityType.replace("_", " ")}
                  </Mono>
                </div>
              </blockquote>
            ))
          )}
        </section>

        <section className="mt-6 text-sm">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Related</h2>
          <ul className="mt-2 space-y-1">
            {why.iteration ? (
              <li>
                Iteration:{" "}
                <Link href={`/app/iterations/${why.iteration.id}`} className="text-blueprint">
                  {why.iteration.title}
                </Link>{" "}
                <OutcomeBadge outcome={why.iteration.outcome} />
              </li>
            ) : null}
            {why.decisions.map((d) => (
              <li key={d.id}>
                Decision:{" "}
                <Link href={`/app/decisions/${d.id}`} className="text-blueprint">
                  {d.title}
                </Link>{" "}
                <DecisionState disposition={d.disposition} />
              </li>
            ))}
            {why.tests.map((t) => (
              <li key={t.id}>
                Test:{" "}
                <Link href={`/app/tests/${t.id}`} className="text-blueprint">
                  {t.title}
                </Link>{" "}
                <Mono>{testResultLabel(t)}</Mono>
              </li>
            ))}
            {why.events.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <SourceBadge provider={e.provider} eventType={e.eventType} />
                <Link href={`/app/inbox?status=${e.status}&event=${e.id}`} className="text-blueprint">
                  {e.title}
                </Link>
                <Mono>{fmtDate(e.occurredAt)}</Mono>
              </li>
            ))}
          </ul>
        </section>
        <p className="hint mt-6">
          Every statement above traces to a stored object. Missing pieces are reported as “not documented”, never inferred.{" "}
          <Link href="/app/memory" className="text-blueprint">
            Ask project history
          </Link>
        </p>
      </article>
    </div>
  );
}
