import { notFound } from "next/navigation";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, auditEvents, organizationMemberships, organizations, seasons, subscriptions, teamMemberships, teams, users } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { deleteTeam, updateOrganization } from "@/server/actions";
import { PLANS, canCreateTeam, isPlan } from "@/modules/billing/entitlements";
import { Mono, PageHeader, Section, fmtDate } from "@/components/ui";
import { TraceIcon } from "@/components/tracelab/trace-icon";

export default async function OrgPage() {
  const ctx = await requireTeam();
  if (!ctx.team.organizationId) notFound();

  const [org] = await db.select().from(organizations).where(eq(organizations.id, ctx.team.organizationId)).limit(1);
  if (!org) notFound();

  const isAdmin = ctx.orgRole === "admin";
  const orgTeams = await db
    .select({ team: teams, members: count(teamMemberships.id) })
    .from(teams)
    .leftJoin(teamMemberships, and(eq(teamMemberships.teamId, teams.id), eq(teamMemberships.status, "active")))
    .where(eq(teams.organizationId, org.id))
    .groupBy(teams.id);
  const seasonCount = (await db.select({ n: count() }).from(seasons).innerJoin(teams, eq(teams.id, seasons.teamId)).where(eq(teams.organizationId, org.id)))[0].n;
  const admins = await db
    .select({ name: users.displayName, role: organizationMemberships.role })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .where(eq(organizationMemberships.organizationId, org.id));
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.organizationId, org.id)).limit(1);
  const storage = (await db
    .select({ bytes: sql<number>`coalesce(sum(${artifacts.sizeBytes}),0)` })
    .from(artifacts)
    .innerJoin(teams, eq(teams.id, artifacts.teamId))
    .where(eq(teams.organizationId, org.id)))[0].bytes;
  const audit = isAdmin ? await db.select().from(auditEvents).where(eq(auditEvents.organizationId, org.id)).orderBy(desc(auditEvents.createdAt)).limit(30) : [];
  const plan = isPlan(org.plan) ? org.plan : "free";
  const liveBilling = !!process.env.STRIPE_SECRET_KEY;
  const storageMb = (Number(storage) / 1_048_576).toFixed(1);
  const teamLimit = PLANS[plan].maxTeams === Infinity ? "unlimited" : String(PLANS[plan].maxTeams);

  return (
    <div>
      <PageHeader title={org.name} subtitle="Multi-team continuity, archive controls and organization access. Team evidence remains private to each team." />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,.8fr)]">
        <div className="evidence-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-blueprint-bg text-blueprint">
              <TraceIcon name="org" size={20} />
            </span>
            <div>
              <p className="trace-meta text-[11px] uppercase text-text-3">Organization archive</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Multi-team continuity</h2>
              <p className="mt-1 max-w-2xl text-sm text-text-2">Preserve seasons and operating context across teams without combining their private engineering records into a surveillance feed.</p>
            </div>
          </div>

          <dl className="mt-6 grid gap-px overflow-hidden rounded-[16px] border border-border-subtle bg-border-subtle sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Teams", String(orgTeams.length), `limit ${teamLimit}`],
              ["Seasons archived", String(Number(seasonCount)), "across organization teams"],
              ["Storage", `${storageMb} MB`, `${PLANS[plan].storageGb} GB included`],
              ["Plan", PLANS[plan].name, sub ? `${sub.status} · ${sub.provider}` : "no subscription record"],
            ].map(([label, value, hint]) => (
              <div key={label} className="bg-bg-surface p-4">
                <dt className="trace-meta text-[10px] uppercase text-text-3">{label}</dt>
                <dd className="mt-1 text-lg font-semibold">{value}</dd>
                <p className="mt-0.5 text-xs text-text-3">{hint}</p>
              </div>
            ))}
          </dl>
        </div>

        <aside className="trace-surface-subtle p-5">
          <p className="trace-meta text-[11px] uppercase text-text-3">Continuity guardrails</p>
          <div className="mt-4 space-y-4 text-sm">
            <Guardrail icon="evidence" title="Team evidence stays scoped">Organization access does not turn private project evidence into one shared activity stream.</Guardrail>
            <Guardrail icon="handoff" title="Seasons remain recoverable">Archive value comes from retaining engineering memory, not maximizing note volume.</Guardrail>
            <Guardrail icon="policy" title="Retention is explicit">Only eligible unlinked inbox events follow retention settings; linked evidence and student reasoning are preserved.</Guardrail>
          </div>
        </aside>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <Section title="Team archive">
          <div className="space-y-2">
            {orgTeams.map(({ team, members }) => (
              <article key={team.id} className="evidence-card flex items-center justify-between gap-4 p-4 text-sm">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{team.name}</span>
                    {team.number ? <Mono>#{team.number}</Mono> : null}
                  </div>
                  <p className="mt-1 text-xs text-text-3">{team.program} · private team workspace</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{members} active</p>
                  <p className="mt-0.5 text-xs text-text-3">members</p>
                </div>
              </article>
            ))}
          </div>
          <p className="hint mt-3">{canCreateTeam(plan, orgTeams.length) ? "Another team can be created from Onboarding." : "The current plan team limit has been reached."}</p>
        </Section>

        <Section title="Organization access">
          <div className="trace-surface overflow-hidden">
            {admins.map((member, index) => (
              <div key={`${member.name}-${index}`} className="flex items-center justify-between gap-3 border-b border-border-subtle p-4 text-sm last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-bg-subtle text-text-2"><TraceIcon name="members" size={16} /></span>
                  <span className="font-medium">{member.name}</span>
                </div>
                <span className="badge">{member.role}</span>
              </div>
            ))}
          </div>
          <p className="hint mt-3">Organization roles manage continuity and administration; they do not grant silent authorship over student rationale.</p>
        </Section>
      </div>

      {isAdmin ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <Section title="Archive & retention">
            <form action={updateOrganization} className="trace-surface space-y-4 p-5 text-sm">
              <label className="block">
                <span className="label">Unlinked inbox retention (days)</span>
                <input name="retentionDays" type="number" min={30} className="input mono" defaultValue={org.retentionDays ?? ""} placeholder="Keep indefinitely" />
                <span className="hint mt-1 block">Blank means keep indefinitely. Linked evidence, tests, decisions and student reasoning are never auto-deleted by this setting.</span>
              </label>
              <label className="block">
                <span className="label">Plan {liveBilling ? "(managed by billing provider)" : "(development billing adapter)"}</span>
                <select name="plan" className="select" defaultValue={plan} disabled={liveBilling}>
                  {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((key) => <option key={key} value={key}>{PLANS[key].name}</option>)}
                </select>
              </label>
              <button className="btn btn-primary">Save archive policy</button>
              <p className="hint">{liveBilling ? "Plan changes go through the billing portal; webhooks synchronize entitlements." : "STRIPE_SECRET_KEY is not set: plan changes are recorded locally for development."}</p>
            </form>
          </Section>

          <Section title="Audit trail">
            <div className="trace-surface max-h-96 overflow-y-auto">
              {audit.map((event) => (
                <div key={event.id} className="border-b border-border-subtle p-3 text-xs last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Mono>{fmtDate(event.createdAt, true)}</Mono>
                    <span className="badge">{event.action}</span>
                  </div>
                  {event.metadata ? <p className="mt-1 break-words text-text-3">{JSON.stringify(event.metadata)}</p> : null}
                </div>
              ))}
              {audit.length === 0 ? <p className="p-4 text-sm text-text-3">No organization-level audit events yet.</p> : null}
            </div>
          </Section>
        </div>
      ) : null}

      {(isAdmin || ctx.role === "student_lead") ? (
        <details className="mt-8 rounded-[18px] border border-danger/40 bg-danger-bg/30 p-4 text-sm">
          <summary className="cursor-pointer font-semibold text-danger">Delete team “{ctx.team.name}”</summary>
          <p className="hint mt-2">Irreversible. Type the exact team name to confirm. An audit event is recorded and storage cleanup is queued.</p>
          <form action={deleteTeam} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input name="confirm" className="input sm:!w-64" placeholder={ctx.team.name} required />
            <button className="btn btn-danger">Delete team</button>
          </form>
        </details>
      ) : null}
    </div>
  );
}

function Guardrail({ icon, title, children }: { icon: string; title: string; children: string }) {
  return (
    <div className="flex gap-3">
      <TraceIcon name={icon} className="mt-0.5 h-4 w-4 shrink-0 text-text-2" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-text-2">{children}</p>
      </div>
    </div>
  );
}
