// locale-wired
import { UiText } from "@/components/locale-provider";
import type { ReactNode } from "react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { exports as exportsTable, policyVersions, users } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { gate, loadTeamPolicy } from "@/server/policy";
import { coachInsights } from "@/server/evidence";
import { ExportButton } from "./export-button";
import { EvidenceGap, Mono, PageHeader, PolicyBadge, fmtDate } from "@/components/ui";
import { TraceIcon } from "@/components/tracelab/trace-icon";

export default async function ExportsPage() {
  const ctx = await requireTeam();
  const policy = await loadTeamPolicy(ctx.team);
  const gen = await gate(ctx, "export_generated_content");
  const det = await gate(ctx, "export_deterministic_notebook");
  const insights = await coachInsights(ctx.team.id);
  const rows = await db.select({ e: exportsTable, creator: users.displayName, pv: policyVersions.version }).from(exportsTable).leftJoin(users, eq(users.id, exportsTable.createdBy)).leftJoin(policyVersions, eq(policyVersions.id, exportsTable.policyVersionId)).where(eq(exportsTable.teamId, ctx.team.id)).orderBy(desc(exportsTable.createdAt)).limit(50);
  const constraints = (policy.version?.constraints ?? {}) as Record<string, unknown>;
  const readiness = [
    { ok: insights.decisionEvidenceRate != null && insights.decisionEvidenceRate >= 60, label: `Decisions linked to evidence: ${insights.decisionEvidenceRate ?? 0}%` },
    { ok: insights.testsWithoutDecision.length === 0, label: `Tests with a downstream decision: ${insights.testsWithoutDecision.length} missing` },
    { ok: insights.decisionsWithoutEvidence.length === 0, label: `${insights.decisionsWithoutEvidence.length} decisions without evidence` },
    { ok: insights.unclassifiedEvents === 0, label: `${insights.unclassifiedEvents} source events still unclassified` },
    { ok: insights.openDecisions === 0, label: `${insights.openDecisions} open decisions` },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="Outputs" subtitle="One evidence base, multiple competition-safe views. Compose from linked evidence instead of maintaining duplicate documents." />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Output selector" /></div>
                <h2 className="mt-1 text-lg font-semibold"><UiText text="Choose an output" /></h2>
              </div>
              <span className="badge badge-decision"><UiText text="Policy pinned · " /><UiText text={policy.version?.version ?? "none"} /></span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <OutputCard icon="export" title="Engineering notebook view" description="Chronological evidence, student-authored rationale, tests and decisions. Deterministic under strict competition modes." policy={<PolicyBadge decision={det.decision} />} action={<ExportButton type="vex_notebook" label="Build notebook view" />} />
              <OutputCard icon="evidence" title="FTC portfolio" description={`Evidence-first composition${constraints.maxContentPages ? ` · cover + ${String(constraints.maxContentPages)} pages` : ""}${constraints.maxFileMb ? ` · ≤ ${String(constraints.maxFileMb)} MB` : ""}.`} policy={<PolicyBadge decision={gen.decision} />} action={<ExportButton type="ftc_portfolio" label="Build portfolio draft" allowGenerated />} />
              <OutputCard icon="memory" title="Season handoff" description="Subsystem decisions, known failures, proven tests and unresolved questions for the next team." action={<ExportButton type="season_handoff" label="Build handoff" />} />
              <OutputCard icon="members" title="Contribution evidence" description="A portable record of the evidence a student actually authored, tested, linked or contributed to — never a score." action={<div className="flex flex-wrap gap-2"><ExportButton type="personal_contribution" label="My contribution" />{ctx.canOrganize ? <ExportButton type="team_data" label="Team data" /> : null}</div>} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <div className="card p-5">
              <div className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Validation & trust checks" /></div>
              <h2 className="mt-1 font-semibold"><UiText text="Before export" /></h2>
              <ul className="mt-4 space-y-2">
                {readiness.map((item) => <EvidenceGap key={item.label} ok={item.ok} label={item.label} />)}
                <EvidenceGap ok={policy.version?.status === "active"} label={`Policy version active: ${policy.version?.version ?? "none"}`} />
                <EvidenceGap ok={det.allowed} label="Deterministic export allowed" />
              </ul>
              <p className="hint mt-4"><UiText text="These are structural checks only. The composer never invents a stronger engineering story to satisfy a rubric." /></p>
            </div>

            <div className="card p-5">
              <h2 className="font-semibold"><UiText text="Your project, your evidence" /></h2>
              <p className="mt-3 text-sm leading-6 text-text-2"><UiText text="Exports use only your saved materials, tests and decisions. Create an output above to download the result." /></p>
              <p className="hint mt-3"><UiText text="Downloads are HTML documents. PDF page limits must be checked separately." /></p>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <div className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Active export policy" /></div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><span className="font-semibold"><UiText text={policy.profile?.name ?? "No profile"} /></span><span className="badge"><UiText text={policy.version?.version ?? "—"} /></span></div>
            <p className="mt-2 text-sm leading-6 text-text-2"><UiText text="Every generated export record stores the policy decision/version so a later rule update does not rewrite history." /></p>
            {!gen.allowed ? <p className="mt-2 rounded-[12px] bg-warning-bg px-3 py-2 text-xs leading-5 text-warning"><UiText text="Generated-content export is restricted: " /><UiText text={gen.reason} /></p> : null}
          </section>

          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3"><UiText text="Export history" /></h2>
            {rows.length === 0 ? <p className="mt-2 text-sm text-text-3"><UiText text="No outputs created yet." /></p> : (
              <ul className="mt-3 space-y-2 text-sm">
                {rows.map(({ e, creator, pv }) => (
                  <li key={e.id} className="rounded-[14px] border border-border bg-canvas p-3">
                    <div className="flex items-center justify-between gap-2"><span className="font-medium"><UiText text={e.type.replace(/_/g, " ")} /> v<UiText text={e.version} /></span><span className={`badge ${e.status === "ready" ? "badge-success" : e.status === "blocked" ? "badge-danger" : "badge-warning"}`}><UiText text={e.status} /></span></div>
                    <Mono><UiText text={creator ?? "—"} /> · {fmtDate(e.createdAt, true)}</Mono>
                    <Mono className="mt-1 block"><UiText text="policy " /><UiText text={pv ?? "none"} /> · <UiText text={e.policyDecision ?? "—"} /><UiText text={e.hash ? ` · ${e.hash.slice(0, 10)}` : ""} /></Mono>
                    {e.status === "ready" && (!e.forUserId || e.forUserId === ctx.user.id) ? <a href={`/api/exports/${e.id}`} className="mt-2 block text-xs font-semibold text-blueprint"><UiText text="Download output →" /></a> : null}
                    {e.error ? <p className="mt-1 text-xs text-danger"><UiText text={e.error} /></p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function OutputCard({ icon, title, description, policy, action }: { icon: string; title: string; description: string; policy?: ReactNode; action: ReactNode }) {
  return (
    <article className="evidence-card p-5" data-tone="source">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-border bg-canvas text-blueprint"><TraceIcon name={icon} size={19} /></span>
        <UiText text={policy} />
      </div>
      <h3 className="mt-4 font-semibold"><UiText text={title} /></h3>
      <p className="mt-1 min-h-12 text-sm leading-6 text-text-2"><UiText text={description} /></p>
      <div className="mt-4"><UiText text={action} /></div>
    </article>
  );
}
