import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { decisions, relations, subsystems, tests } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { EmptyState, OutcomeBadge, PageHeader, TestResult, fmtDate } from "@/components/ui";
import { TraceIcon } from "@/components/tracelab/trace-icon";

export default async function TestsPage() {
  const ctx = await requireTeam();
  const rows = await db
    .select({ t: tests, subsystem: subsystems.name })
    .from(tests)
    .leftJoin(subsystems, eq(subsystems.id, tests.subsystemId))
    .where(eq(tests.teamId, ctx.team.id))
    .orderBy(desc(tests.performedAt))
    .limit(200);

  const testIds = rows.map((row) => row.t.id);
  const linked = testIds.length
    ? await db
        .select({ relation: relations, decision: decisions })
        .from(relations)
        .innerJoin(decisions, eq(decisions.id, relations.fromId))
        .where(
          and(
            eq(relations.teamId, ctx.team.id),
            eq(relations.fromType, "decision"),
            eq(relations.toType, "test"),
            inArray(relations.toId, testIds),
            eq(relations.status, "accepted"),
          ),
        )
    : [];
  const decisionByTest = new Map<string, (typeof linked)[number]["decision"]>();
  for (const item of linked) if (!decisionByTest.has(item.relation.toId)) decisionByTest.set(item.relation.toId, item.decision);

  return (
    <div className="fade-in">
      <PageHeader
        title="Tests"
        subtitle="Understand what was tested, the result, and which engineering decision it informed. Qualitative tests remain first-class evidence — no number is forced."
        actions={
          <>
            <Link href="/app/integrations#csv" className="btn">Import CSV</Link>
            {ctx.canAuthorStudentContent ? <Link href="/app/capture?kind=test" className="btn btn-primary">New test</Link> : null}
          </>
        }
      />

      {rows.length === 0 ? (
        <EmptyState title="No tests yet" body="A test connects a question or change to evidence and then to a decision. Record what was tested and what the result changed." action={ctx.canAuthorStudentContent ? <Link href="/app/capture?kind=test" className="btn btn-primary">Capture a test</Link> : undefined} />
      ) : (
        <div className="space-y-3">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(180px,0.9fr)_minmax(180px,0.9fr)_120px] gap-4 px-4 text-[10px] font-semibold uppercase tracking-[0.07em] text-text-3 md:grid">
            <span>Test</span><span>Result</span><span>Linked decision</span><span>Date</span>
          </div>
          <ul className="space-y-2">
            {rows.map(({ t, subsystem }, index) => {
              const decision = decisionByTest.get(t.id);
              return (
                <li key={t.id}>
                  <article className="evidence-card" data-tone={t.outcome === "pass" ? "verified" : t.outcome === "fail" ? "failure" : "test"}>
                    <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(180px,0.9fr)_minmax(180px,0.9fr)_120px] md:items-center">
                      <div className="min-w-0">
                        <div className="trace-meta text-[9px] uppercase text-text-3">TEST · T-{String(rows.length - index).padStart(3, "0")} · {subsystem ?? "UNASSIGNED"}</div>
                        <Link href={`/app/tests/${t.id}`} className="mt-1 block truncate text-sm font-semibold hover:text-blueprint hover:underline">{t.title}</Link>
                        <div className="mt-1 text-xs text-text-3">{t.question ?? t.targetLabel ?? t.targetType}</div>
                      </div>

                      <div>
                        <div className="mb-1 md:hidden"><span className="trace-meta text-[9px] uppercase text-text-3">Result</span></div>
                        <div className="flex flex-wrap items-center gap-2"><TestResult trials={t.trials} successes={t.successes} value={t.value} units={t.units} outcome={t.outcome} /><OutcomeBadge outcome={t.outcome} /></div>
                      </div>

                      <div>
                        <div className="mb-1 md:hidden"><span className="trace-meta text-[9px] uppercase text-text-3">Linked decision</span></div>
                        {decision ? (
                          <Link href={`/app/decisions/${decision.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-blueprint hover:underline">
                            <TraceIcon name="decision" size={15} /> {decision.title}
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-2 text-sm text-text-3"><TraceIcon name="decision" size={15} /> No decision linked</span>
                        )}
                      </div>

                      <div className="md:text-right">
                        <div className="mb-1 md:hidden"><span className="trace-meta text-[9px] uppercase text-text-3">Date</span></div>
                        <span className="mono text-[11px] text-text-3">{fmtDate(t.performedAt)}</span>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
