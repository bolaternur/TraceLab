// locale-wired
import { UiText } from "@/components/locale-provider";
import Link from "next/link";
import { requireTeam } from "@/server/auth";
import { failureLibrary, testResultLabel } from "@/server/evidence";
import { EmptyState, Mono, OutcomeBadge, PageHeader, ProvenanceLabel, TestResult, fmtDate } from "@/components/ui";

export default async function FailuresPage() {
  const ctx = await requireTeam();
  const lib = await failureLibrary(ctx.team.id);
  return (
    <div className="fade-in">
      <PageHeader title="Failure Library" subtitle="Rejected approaches and failed tests, with the student's own conclusion and the conditions under which a retry might make sense. Searchable across seasons." />
      {lib.rejected.length === 0 && lib.failedTests.length === 0 ? (
        <EmptyState title="No rejected approach has been documented yet" body="When an iteration closes as rejected or reverted, or a test fails, it appears here for future teams." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-3"><UiText text="Rejected / reverted approaches · " /><UiText text={lib.rejected.length} /></h2>
            <ul className="space-y-3">
              {lib.rejected.map(({ it, subsystem, season }) => {
                const conclusion = lib.conclusions.find((c) => c.entityId === it.id);
                return (
                  <li key={it.id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/app/iterations/${it.id}`} className="font-semibold hover:underline">
                        <UiText text={it.title} />
                      </Link>
                      <span className="flex items-center gap-2">
                        <OutcomeBadge outcome={it.outcome} />
                        <Mono>
                          <UiText text={season} /> · {subsystem ?? "—"}
                        </Mono>
                      </span>
                    </div>
                    {it.problemOrGoal ? <p className="mt-2 text-sm text-text-2"><UiText text="Problem: " /><UiText text={it.problemOrGoal} /></p> : null}
                    {conclusion ? (
                      <blockquote className="mt-2 border-l-2 border-teal pl-3 text-sm">
                        <UiText text={conclusion.body} />
                        <div className="mt-1">
                          <ProvenanceLabel kind="student" />
                        </div>
                      </blockquote>
                    ) : (
                      <p className="mt-2 text-sm text-text-3"><UiText text="Student conclusion not documented." /></p>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Link href={`/app/why/iteration/${it.id}`} className="btn btn-sm"><UiText text="Why? " /></Link>
                      <Mono className="self-center"><UiText text="closed " />{fmtDate(it.closedAt)}</Mono>
                    </div>
                  </li>
                );
              })}
              {lib.rejected.length === 0 ? <li className="text-sm text-text-3"><UiText text="None yet." /></li> : null}
            </ul>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-3"><UiText text="Failed tests · " /><UiText text={lib.failedTests.length} /></h2>
            <ul className="card divide-y divide-border">
              {lib.failedTests.map(({ t, subsystem }) => (
                <li key={t.id} className="p-3">
                  <Link href={`/app/tests/${t.id}`} className="font-medium hover:underline">
                    <UiText text={t.title} />
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <TestResult trials={t.trials} successes={t.successes} value={t.value} units={t.units} outcome={t.outcome} />
                    <Mono>
                      {subsystem ?? "—"} · {fmtDate(t.performedAt)} · {testResultLabel(t)}
                    </Mono>
                  </div>
                  {t.observations ? <p className="mt-1 text-sm text-text-2"><UiText text={t.observations} /></p> : null}
                </li>
              ))}
              {lib.failedTests.length === 0 ? <li className="p-3 text-sm text-text-3"><UiText text="None yet." /></li> : null}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
