// locale-wired
import { UiText } from "@/components/locale-provider";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { competitionProfiles, policyVersions } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { gate, loadTeamPolicy } from "@/server/policy";
import { setCompetitionProfile, toggleStudentOwnedMode } from "@/server/actions";
import { POLICY_ACTIONS, type ActionMatrix } from "@/modules/policies/engine";
import { Mono, Notice, PageHeader, PolicyBadge, fmtDate } from "@/components/ui";
import { PolicyDemo, PolicyVersionForm } from "./policy-forms";
import { brand } from "@/lib/brand";
import { TraceIcon } from "@/components/tracelab/trace-icon";

export default async function CompetitionPage() {
  const ctx = await requireTeam();
  const profiles = await db.select().from(competitionProfiles).orderBy(asc(competitionProfiles.name));
  const versions = await db.select().from(policyVersions).orderBy(desc(policyVersions.createdAt));
  const policy = await loadTeamPolicy(ctx.team);
  const decisions = await Promise.all(POLICY_ACTIONS.map(async (action) => ({ action, result: await gate(ctx, action) })));
  const canManage = ctx.user.platformRole === "platform_admin";
  const restricted = decisions.filter(({ result }) => !result.allowed);

  return (
    <div className="fade-in">
      <PageHeader
        title="Competition Mode"
        subtitle={`The active rule pack controls AI, authorship-sensitive actions and exports. Research snapshot: ${brand.policySnapshotDate}. No official certification is claimed.`}
      />

      <section className="relative mb-6 overflow-hidden rounded-[28px] border border-border bg-surface p-5 sm:p-6">
        <div className="absolute inset-y-0 left-0 w-1 bg-decision" aria-hidden />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            <div className="trace-meta text-[10px] uppercase text-text-3"><UiText text={policy.profile?.program ?? ctx.team.program} /><UiText text="· Competition Mode" /></div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]"><UiText text={policy.profile?.name ?? "No competition profile selected"} /></h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="badge badge-decision"><UiText text="Policy Pack" /></span>
              <span className="badge"><UiText text={policy.version?.version ?? "no version"} /></span>
              <span className={`badge ${policy.version?.status === "active" ? "badge-success" : "badge-warning"}`}><UiText text={policy.version?.status ?? "unconfigured"} /></span>
              {policy.version?.reviewedAt ? <Mono><UiText text="reviewed " />{fmtDate(policy.version.reviewedAt)}</Mono> : <Mono><UiText text="not reviewed" /></Mono>}
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-2"><UiText text="Policy is executable server-side behavior. The interface shows what is protected, which actions are restricted, and which exact version governed an export or AI request. " /></p>
          </div>
          <div className="rounded-[18px] border border-border bg-canvas p-4">
            <div className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Trust guarantees" /></div>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li className="flex gap-2"><span className="text-success" aria-hidden>●</span><span><UiText text="Student-authored rationale preserved" /></span></li>
              <li className="flex gap-2"><span className="text-success" aria-hidden>●</span><span><UiText text="Source provenance preserved" /></span></li>
              <li className="flex gap-2"><span className="text-decision" aria-hidden>●</span><span><UiText text="Restricted AI actions blocked" /></span></li>
              <li className="flex gap-2"><span className="text-test" aria-hidden>●</span><span><UiText text="Export checks enabled" /></span></li>
            </ul>
          </div>
        </div>
      </section>

      {policy.version?.status === "needs_review" ? (
        <div className="mb-6">
          <Notice tone="warning">
            <strong><UiText text="Policy review pending." /></strong><UiText text="A newer competition manual may change AI/export rules. Current restrictions remain active until reviewed; evidence capture and deterministic exports continue to work. " /></Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <TraceIcon name="policy" size={18} className="text-decision" />
              <h2 className="font-semibold"><UiText text="Effective action matrix" /></h2>
            </div>
            <p className="mt-1 text-sm text-text-2">
              <UiText text={restricted.length} /><UiText text="of " /><UiText text={decisions.length} /><UiText text="modeled actions are currently restricted. A restriction is a policy decision, not a disabled-looking mystery control. " /></p>
            <div className="mt-4 overflow-hidden rounded-[16px] border border-border">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-[10px] uppercase tracking-[0.06em] text-text-3">
                  <tr>
                    <th className="px-3 py-2 font-semibold"><UiText text="Action" /></th>
                    <th className="px-3 py-2 font-semibold"><UiText text="Decision" /></th>
                    <th className="px-3 py-2 font-semibold"><UiText text="Why this is restricted / allowed" /></th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map(({ action, result }) => (
                    <tr key={action} className="border-t border-border align-top">
                      <td className="mono px-3 py-3 text-xs"><UiText text={action} /></td>
                      <td className="px-3 py-3"><PolicyBadge decision={result.decision} /></td>
                      <td className="px-3 py-3 text-xs leading-5 text-text-2"><UiText text={result.reason} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <div className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Competition profile" /></div>
              <h2 className="mt-1 font-semibold"><UiText text="Choose the rule context" /></h2>
              <form action={setCompetitionProfile} className="mt-3 space-y-2">
                {profiles.map((profile) => (
                  <label key={profile.id} className={`flex cursor-pointer items-start gap-3 rounded-[14px] border p-3 text-sm ${ctx.team.competitionProfileId === profile.id ? "border-decision bg-[var(--decision-violet-soft)]" : "border-border"}`}>
                    <input type="radio" name="profileId" value={profile.id} defaultChecked={ctx.team.competitionProfileId === profile.id} className="mt-1" disabled={!ctx.canOrganize} />
                    <span>
                      <span className="font-medium"><UiText text={profile.name} /></span> {profile.strict ? <span className="badge badge-danger ml-1"><UiText text="strict" /></span> : null}
                      <span className="mt-0.5 block text-text-2"><UiText text={profile.description} /></span>
                    </span>
                  </label>
                ))}
                {ctx.canOrganize ? <button className="btn btn-primary"><UiText text="Apply profile" /></button> : <p className="hint"><UiText text="Only leads and coaches change the profile." /></p>}
              </form>
            </div>

            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Authorship protection" /></div>
                  <h2 className="mt-1 font-semibold"><UiText text="Student-Owned Mode" /></h2>
                </div>
                <span className={`badge ${ctx.team.studentOwnedMode ? "badge-teal" : ""}`}><UiText text={ctx.team.studentOwnedMode ? "enabled" : "disabled"} /></span>
              </div>
              <p className="mt-3 text-sm leading-6 text-text-2"><UiText text="Preserves student-authored engineering content and disables generative transformations restricted by the active policy. This is executable policy, not a marketing toggle. " /></p>
              {ctx.canOrganize ? (
                <form action={toggleStudentOwnedMode} className="mt-4">
                  <input type="hidden" name="enabled" value={ctx.team.studentOwnedMode ? "false" : "true"} />
                  <button className="btn"><UiText text={ctx.team.studentOwnedMode ? "Disable" : "Enable"} /><UiText text="Student-Owned Mode" /></button>
                </form>
              ) : null}
            </div>
          </section>

          <section className="evidence-card p-5" data-tone="decision">
            <div className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Restricted action pattern" /></div>
            <h2 className="mt-1 text-lg font-semibold"><UiText text="AI rewrite unavailable" /></h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-2"><UiText text="This action could alter student-authored engineering evidence under the active competition policy. The system blocks it rather than silently changing the student's words. " /></p>
            <details className="mt-3 rounded-[14px] border border-border bg-canvas px-3.5 py-3 text-sm">
              <summary className="cursor-pointer font-semibold text-blueprint"><UiText text="Why this is restricted" /></summary>
              <p className="mt-2 leading-6 text-text-2"><UiText text="The exact reason comes from the active action matrix above. Change the policy version only after reviewing the governing competition source." /></p>
            </details>
            <div className="mt-4 border-t border-border pt-4">
              <div className="trace-meta text-[9px] uppercase text-text-3"><UiText text="Try the real gate" /></div>
              <p className="hint mt-1"><UiText text="Requests an AI rewrite of sample text through the existing server-side policy gate." /></p>
              <div className="mt-3"><PolicyDemo /></div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3"><UiText text="Policy details" /></h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-xs text-text-3"><UiText text="Competition" /></dt><dd className="font-semibold">{policy.profile?.name ?? "Not selected"}</dd></div>
              <div><dt className="text-xs text-text-3"><UiText text="Policy pack version" /></dt><dd className="mono"><UiText text={policy.version?.version ?? "—"} /></dd></div>
              <div><dt className="text-xs text-text-3"><UiText text="Last reviewed" /></dt><dd><UiText text={policy.version?.reviewedAt ? `${fmtDate(policy.version.reviewedAt)} · ${policy.version.reviewer ?? "reviewer not recorded"}` : "Not reviewed"} /></dd></div>
              <div><dt className="text-xs text-text-3"><UiText text="Status" /></dt><dd><span className={`badge ${policy.version?.status === "active" ? "badge-success" : "badge-warning"}`}><UiText text={policy.version?.status ?? "none"} /></span></dd></div>
            </dl>
          </section>

          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3"><UiText text="Policy Update Center" /></h2>
            <ul className="mt-2 space-y-3 text-sm">
              {profiles.map((profile) => (
                <li key={profile.id}>
                  <div className="font-medium"><UiText text={profile.name} /></div>
                  <ul className="ml-2 mt-1 space-y-2 border-l border-border pl-3">
                    {versions.filter((version) => version.profileId === profile.id).map((version) => (
                      <li key={version.id} className="text-xs">
                        <div className="flex flex-wrap items-center gap-1.5"><span className="mono"><UiText text={version.version} /></span><span className={`badge ${version.status === "active" ? "badge-success" : version.status === "needs_review" ? "badge-warning" : version.status === "superseded" ? "" : "badge-blueprint"}`}><UiText text={version.status} /></span></div>
                        <div className="mt-1 text-text-3"><UiText text={version.effectiveFrom ? `effective ${fmtDate(version.effectiveFrom)}` : "no effective date"} /> · <UiText text={version.reviewedAt ? `reviewed ${fmtDate(version.reviewedAt)} by ${version.reviewer}` : "not reviewed"} /></div>
                        {version.changelog ? <div className="mt-1 text-text-2"><UiText text={version.changelog} /></div> : null}
                        {(version.sourceUrls as string[]).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="mt-1 block truncate text-blueprint"><UiText text="Source ↗" /></a>)}
                        <details className="mt-1"><summary className="cursor-pointer text-text-3"><UiText text="action matrix" /></summary><Mono className="mt-1 block whitespace-pre-wrap">{JSON.stringify(version.actionMatrix as ActionMatrix, null, 0).replace(/,/g, ", ")}</Mono></details>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {canManage ? (
            <section className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3"><UiText text="Record a new policy version" /></h2>
              <p className="hint mt-1"><UiText text="Creates an immutable version; activating supersedes the previous active version. Historical exports stay pinned." /></p>
              <PolicyVersionForm profiles={profiles.map((profile) => ({ id: profile.id, name: profile.name }))} />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
