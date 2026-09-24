import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { seasons, sourceConnections } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { coachInsights } from "@/server/evidence";
import { loadTeamPolicy } from "@/server/policy";
import { PageHeader, Section, SourceBadge } from "@/components/ui";
import { ProcessHealthCard } from "@/components/tracelab/process-health-card";

export default async function CoachPage() {
  const ctx = await requireTeam();
  if (!ctx.isCoach) notFound();
  const i = await coachInsights(ctx.team.id);
  const policy = await loadTeamPolicy(ctx.team);
  const conns = await db.select().from(sourceConnections).where(eq(sourceConnections.teamId, ctx.team.id));
  const [season] = await db.select().from(seasons).where(and(eq(seasons.teamId, ctx.team.id), eq(seasons.isActive, true))).orderBy(desc(seasons.year)).limit(1);

  return (
    <div className="fade-in">
      <PageHeader title={`${ctx.team.name} — Coach`} subtitle="Process visibility, not surveillance. This view surfaces missing structure and intervention opportunities; it never ranks students by activity volume." />

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="trace-meta text-[9px] uppercase text-text-3">Project evidence health</div>
            <h2 className="mt-1 text-lg font-semibold">Where the engineering record needs attention</h2>
          </div>
          <span className="badge">team-level · not a ranking</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProcessHealthCard label="Decision evidence" value={i.decisionEvidenceRate == null ? "—" : `${i.decisionEvidenceRate}%`} explanation="Share of decisions connected to supporting evidence. Quality of the link matters more than raw decision count." href="/app/decisions" tone={i.decisionEvidenceRate != null && i.decisionEvidenceRate >= 70 ? "good" : "attention"} icon="decision" />
          <ProcessHealthCard label="Missing rationale" value={i.unresolvedClusters} explanation="Recent source-event clusters that still need student context before they become useful history." href="/app/inbox" tone={i.unresolvedClusters === 0 ? "good" : "attention"} icon="evidence" />
          <ProcessHealthCard label="Tests → decisions" value={i.testsWithoutDecision.length} explanation="Structured tests with measurements/evidence but no downstream decision connected yet." href="/app/tests" tone={i.testsWithoutDecision.length === 0 ? "good" : "attention"} icon="test" />
          <ProcessHealthCard label="Testing recency" value={i.daysSinceLastTest == null ? "—" : `${i.daysSinceLastTest} d`} explanation="Time since the latest structured test. This is a process signal, not a student productivity target." href="/app/tests" tone={i.daysSinceLastTest != null && i.daysSinceLastTest <= 14 ? "good" : "attention"} icon="timeline" />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <Section title="Interventions">
          <div className="space-y-3">
            {i.decisionsWithoutEvidence.slice(0, 6).map((decision) => (
              <article key={decision.id} className="evidence-card flex flex-wrap items-center justify-between gap-3 p-4" data-tone="decision">
                <div>
                  <div className="trace-meta text-[9px] uppercase text-text-3">Decision evidence gap</div>
                  <div className="mt-1 text-sm font-semibold">{decision.title}</div>
                  <p className="mt-1 text-xs leading-5 text-text-2">Ask the team which test, source artifact or observation actually supported this choice.</p>
                </div>
                <Link href={`/app/decisions/${decision.id}`} className="btn btn-sm">Review decision</Link>
              </article>
            ))}
            {i.testsWithoutDecision.slice(0, 6).map((test) => (
              <article key={test.id} className="evidence-card flex flex-wrap items-center justify-between gap-3 p-4" data-tone="test">
                <div>
                  <div className="trace-meta text-[9px] uppercase text-text-3">Test conclusion gap</div>
                  <div className="mt-1 text-sm font-semibold">{test.title}</div>
                  <p className="mt-1 text-xs leading-5 text-text-2">The evidence exists; prompt students to record what this result changed or ruled out.</p>
                </div>
                <Link href={`/app/tests/${test.id}`} className="btn btn-sm">Review test</Link>
              </article>
            ))}
            {i.decisionsWithoutEvidence.length === 0 && i.testsWithoutDecision.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-border bg-canvas p-5 text-sm text-text-2">No deterministic decision/test gaps detected. Continue reviewing context quality rather than chasing more activity.</div>
            ) : null}
          </div>
          <p className="hint mt-3">Coaches can leave coach notes on allowed surfaces but cannot rewrite student-authored rationale; the server enforces that boundary.</p>
        </Section>

        <div>
          <Section title="Season, policy & integration health">
            <ul className="card divide-y divide-border text-sm">
              <li className="flex items-center justify-between gap-3 p-3.5"><span>Season handoff</span><span className={`badge ${season?.handoffCompletedAt ? "badge-success" : "badge-warning"}`}>{season?.handoffCompletedAt ? "complete" : "incomplete"}</span></li>
              <li className="flex items-center justify-between gap-3 p-3.5"><span>Competition policy</span><span className={`badge ${policy.version?.status === "active" ? "badge-success" : "badge-warning"}`}>{policy.version ? `${policy.version.version} · ${policy.version.status}` : "none selected"}</span></li>
              <li className="flex items-center justify-between gap-3 p-3.5"><span>Open subsystem decisions</span><span className={`badge ${i.openDecisions === 0 ? "badge-success" : "badge-warning"}`}>{i.openDecisions}</span></li>
              <li className="flex items-center justify-between gap-3 p-3.5"><span>Iterations open &gt; 3 weeks</span><span className={`badge ${i.staleIterations === 0 ? "badge-success" : "badge-warning"}`}>{i.staleIterations}</span></li>
              {conns.map((connection) => (
                <li key={connection.id} className="flex items-center justify-between gap-3 p-3.5"><span className="flex items-center gap-2"><SourceBadge provider={connection.provider} /> {connection.label}</span><span className={`badge ${connection.status === "active" ? "badge-success" : connection.status === "pending" ? "badge-warning" : "badge-danger"}`}>{connection.status}</span></li>
              ))}
              {conns.length === 0 ? <li className="p-3.5 text-text-3">No integrations connected.</li> : null}
            </ul>
          </Section>

          <section className="rounded-[18px] border border-border bg-canvas p-4">
            <div className="trace-meta text-[9px] uppercase text-text-3">Contribution context</div>
            <p className="mt-2 text-sm leading-6 text-text-2"><strong className="text-ink">{i.contributorsThisMonth} / {i.activeMembers}</strong> active members connected evidence in the last 30 days. Treat this as a distribution signal, not a ranking or score.</p>
            <Link href="/app/contribution" className="mt-3 inline-block text-xs font-semibold text-blueprint">View evidence-based contribution summaries →</Link>
          </section>
        </div>
      </div>
    </div>
  );
}
