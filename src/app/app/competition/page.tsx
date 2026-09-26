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
            <div className="trace-meta text-[10px] uppercase text-text-3">{policy.profile?.program ?? ctx.team.program} · Competition Mode</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{policy.profile?.name ?? "No competition profile selected"}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="badge badge-decision">Policy Pack</span>
              <span className="badge">{policy.version?.version ?? "no version"}</span>
              <span className={`badge ${policy.version?.status === "active" ? "badge-success" : "badge-warning"}`}>{policy.version?.status ?? "unconfigured"}</span>
              {policy.version?.reviewedAt ? <Mono>reviewed {fmtDate(policy.version.reviewedAt)}</Mono> : <Mono>not reviewed</Mono>}
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-text-2">
              Policy is executable server-side behavior. The interface shows what is protected, which actions are restricted, and which exact version governed an export or AI request.
            </p>
          </div>
          <div className="rounded-[18px] border border-border bg-canvas p-4">
            <div className="trace-meta text-[9px] uppercase text-text-3">Trust guarantees</div>
            <ul className="mt-3 space-y-2.5 text-sm">
              <li className="flex gap-2"><span className="text-success" aria-hidden>●</span><span>Student-authored rationale preserved</span></li>
              <li className="flex gap-2"><span className="text-success" aria-hidden>●</span><span>Source provenance preserved</span></li>
              <li className="flex gap-2"><span className="text-decision" aria-hidden>●</span><span>Restricted AI actions blocked</span></li>
              <li className="flex gap-2"><span className="text-test" aria-hidden>●</span><span>Export checks enabled</span></li>
            </ul>
          </div>
        </div>
      </section>

      {policy.version?.status === "needs_review" ? (
        <div className="mb-6">
          <Notice tone="warning">
            <strong>Policy review pending.</strong> A newer competition manual may change AI/export rules. Current restrictions remain active until reviewed; evidence capture and deterministic exports continue to work.
          </Notice>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="card p-5">
            <div className="flex items-center gap-2">
              <TraceIcon name="policy" size={18} className="text-decision" />
              <h2 className="font-semibold">Effective action matrix</h2>
            </div>
            <p className="mt-1 text-sm text-text-2">
              {restricted.length} of {decisions.length} modeled actions are currently restricted. A restriction is a policy decision, not a disabled-looking mystery control.
            </p>
            <div className="mt-4 overflow-hidden rounded-[16px] border border-border">
              <table className="w-full text-sm">
                <thead className="bg-canvas text-left text-[10px] uppercase tracking-[0.06em] text-text-3">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Action</th>
                    <th className="px-3 py-2 font-semibold">Decision</th>
                    <th className="px-3 py-2 font-semibold">Why this is restricted / allowed</th>
                  </tr>
                </thead>
                <tbody>
                  {decisions.map(({ action, result }) => (
                    <tr key={action} className="border-t border-border align-top">
                      <td className="mono px-3 py-3 text-xs">{action}</td>
                      <td className="px-3 py-3"><PolicyBadge decision={result.decision} /></td>
                      <td className="px-3 py-3 text-xs leading-5 text-text-2">{result.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <div className="card p-5">
              <div className="trace-meta text-[9px] uppercase text-text-3">Competition profile</div>
              <h2 className="mt-1 font-semibold">Choose the rule context</h2>
              <form action={setCompetitionProfile} className="mt-3 space-y-2">
                {profiles.map((profile) => (
                  <label key={profile.id} className={`flex cursor-pointer items-start gap-3 rounded-[14px] border p-3 text-sm ${ctx.team.competitionProfileId === profile.id ? "border-decision bg-[var(--decision-violet-soft)]" : "border-border"}`}>
                    <input type="radio" name="profileId" value={profile.id} defaultChecked={ctx.team.competitionProfileId === profile.id} className="mt-1" disabled={!ctx.canOrganize} />
                    <span>
                      <span className="font-medium">{profile.name}</span> {profile.strict ? <span className="badge badge-danger ml-1">strict</span> : null}
                      <span className="mt-0.5 block text-text-2">{profile.description}</span>
                    </span>
                  </label>
                ))}
                {ctx.canOrganize ? <button className="btn btn-primary">Apply profile</button> : <p className="hint">Only leads and coaches change the profile.</p>}
              </form>
            </div>

            <div className="card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="trace-meta text-[9px] uppercase text-text-3">Authorship protection</div>
                  <h2 className="mt-1 font-semibold">Student-Owned Mode</h2>
                </div>
                <span className={`badge ${ctx.team.studentOwnedMode ? "badge-teal" : ""}`}>{ctx.team.studentOwnedMode ? "enabled" : "disabled"}</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-text-2">
                Preserves student-authored engineering content and disables generative transformations restricted by the active policy. This is executable policy, not a marketing toggle.
              </p>
              {ctx.canOrganize ? (
                <form action={toggleStudentOwnedMode} className="mt-4">
                  <input type="hidden" name="enabled" value={ctx.team.studentOwnedMode ? "false" : "true"} />
                  <button className="btn">{ctx.team.studentOwnedMode ? "Disable" : "Enable"} Student-Owned Mode</button>
                </form>
              ) : null}
            </div>
          </section>

          <section className="evidence-card p-5" data-tone="decision">
            <div className="trace-meta text-[9px] uppercase text-text-3">Restricted action pattern</div>
            <h2 className="mt-1 text-lg font-semibold">AI rewrite unavailable</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-text-2">
              This action could alter student-authored engineering evidence under the active competition policy. The system blocks it rather than silently changing the student&apos;s words.
            </p>
            <details className="mt-3 rounded-[14px] border border-border bg-canvas px-3.5 py-3 text-sm">
              <summary className="cursor-pointer font-semibold text-blueprint">Why this is restricted</summary>
              <p className="mt-2 leading-6 text-text-2">The exact reason comes from the active action matrix above. Change the policy version only after reviewing the governing competition source.</p>
            </details>
            <div className="mt-4 border-t border-border pt-4">
              <div className="trace-meta text-[9px] uppercase text-text-3">Try the real gate</div>
              <p className="hint mt-1">Requests an AI rewrite of sample text through the existing server-side policy gate.</p>
              <div className="mt-3"><PolicyDemo /></div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Policy details</h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div><dt className="text-xs text-text-3">Competition</dt><dd className="font-semibold">{policy.profile?.name ?? "Not selected"}</dd></div>
              <div><dt className="text-xs text-text-3">Policy pack version</dt><dd className="mono">{policy.version?.version ?? "—"}</dd></div>
              <div><dt className="text-xs text-text-3">Last reviewed</dt><dd>{policy.version?.reviewedAt ? `${fmtDate(policy.version.reviewedAt)} · ${policy.version.reviewer ?? "reviewer not recorded"}` : "Not reviewed"}</dd></div>
              <div><dt className="text-xs text-text-3">Status</dt><dd><span className={`badge ${policy.version?.status === "active" ? "badge-success" : "badge-warning"}`}>{policy.version?.status ?? "none"}</span></dd></div>
            </dl>
          </section>

          <section className="card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Policy Update Center</h2>
            <ul className="mt-2 space-y-3 text-sm">
              {profiles.map((profile) => (
                <li key={profile.id}>
                  <div className="font-medium">{profile.name}</div>
                  <ul className="ml-2 mt-1 space-y-2 border-l border-border pl-3">
                    {versions.filter((version) => version.profileId === profile.id).map((version) => (
                      <li key={version.id} className="text-xs">
                        <div className="flex flex-wrap items-center gap-1.5"><span className="mono">{version.version}</span><span className={`badge ${version.status === "active" ? "badge-success" : version.status === "needs_review" ? "badge-warning" : version.status === "superseded" ? "" : "badge-blueprint"}`}>{version.status}</span></div>
                        <div className="mt-1 text-text-3">{version.effectiveFrom ? `effective ${fmtDate(version.effectiveFrom)}` : "no effective date"} · {version.reviewedAt ? `reviewed ${fmtDate(version.reviewedAt)} by ${version.reviewer}` : "not reviewed"}</div>
                        {version.changelog ? <div className="mt-1 text-text-2">{version.changelog}</div> : null}
                        {(version.sourceUrls as string[]).map((url) => <a key={url} href={url} target="_blank" rel="noreferrer noopener" className="mt-1 block truncate text-blueprint">Source ↗</a>)}
                        <details className="mt-1"><summary className="cursor-pointer text-text-3">action matrix</summary><Mono className="mt-1 block whitespace-pre-wrap">{JSON.stringify(version.actionMatrix as ActionMatrix, null, 0).replace(/,/g, ", ")}</Mono></details>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          {canManage ? (
            <section className="card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Record a new policy version</h2>
              <p className="hint mt-1">Creates an immutable version; activating supersedes the previous active version. Historical exports stay pinned.</p>
              <PolicyVersionForm profiles={profiles.map((profile) => ({ id: profile.id, name: profile.name }))} />
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
