import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { teamInvites } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { listMembers } from "@/server/evidence";
import { createInvite, revokeInvite, updateMember } from "@/server/actions";
import { Mono, PageHeader, fmtDate } from "@/components/ui";
import { inviteIsValid } from "@/lib/time";

export default async function MembersPage() {
  const ctx = await requireTeam();
  const members = await listMembers(ctx.team.id);
  const invites = ctx.canOrganize ? await db.select().from(teamInvites).where(eq(teamInvites.teamId, ctx.team.id)).orderBy(desc(teamInvites.createdAt)).limit(20) : [];
  const appUrl = process.env.APP_URL ?? "";
  return (
    <div className="fade-in">
      <PageHeader title="Team Members" subtitle="Roles: student, student lead, coach. Coaches see everything but never author student content. Departing students become alumni — their contribution history stays intact." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <ul className="card divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div>
                <div className="font-medium">
                  {m.displayName} {m.id === ctx.user.id ? <span className="text-text-3">(you)</span> : null}
                </div>
                <Mono>
                  {m.email} · joined {fmtDate(m.joinedAt)}
                </Mono>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge">{m.role.replace("_", " ")}</span>
                <span className={`badge ${m.status === "active" ? "badge-success" : ""}`}>{m.status}</span>
                {ctx.canOrganize && m.id !== ctx.user.id ? (
                  <form action={updateMember} className="flex gap-1">
                    <input type="hidden" name="userId" value={m.id} />
                    <select name="role" className="select !min-h-7 !w-auto text-xs" defaultValue={m.role} aria-label={`Role for ${m.displayName}`}>
                      <option value="student">student</option>
                      <option value="student_lead">student lead</option>
                      <option value="coach">coach</option>
                    </select>
                    <button className="btn btn-sm">Set role</button>
                    {m.status === "active" ? (
                      <button className="btn btn-sm" name="status" value="alumni">
                        Mark alumni
                      </button>
                    ) : (
                      <button className="btn btn-sm" name="status" value="active">
                        Reactivate
                      </button>
                    )}
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {ctx.canOrganize ? (
          <aside className="space-y-4">
            <form action={createInvite} className="card p-4 text-sm">
              <h2 className="font-semibold">Invite</h2>
              <p className="hint">Links expire after 7 days. Share the URL or the code; QR can be generated from the URL by any QR tool.</p>
              <div className="mt-2 flex gap-2">
                <select name="role" className="select !min-h-8" defaultValue="student" aria-label="Invite role">
                  <option value="student">student</option>
                  <option value="student_lead">student lead</option>
                  <option value="coach">coach</option>
                </select>
                <input name="maxUses" type="number" min={1} max={50} defaultValue={1} className="input mono !min-h-8 !w-20" aria-label="Max uses" />
                <button className="btn btn-sm btn-primary">Create</button>
              </div>
            </form>
            <ul className="card divide-y divide-border text-sm">
              {invites.map((i) => {
                const dead = !inviteIsValid(i);
                return (
                  <li key={i.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <Mono className="!text-ink">{i.code}</Mono>
                      <span className={`badge ${dead ? "" : "badge-success"}`}>{i.revokedAt ? "revoked" : dead ? "expired/used" : `${i.uses}/${i.maxUses} used`}</span>
                    </div>
                    <Mono className="block break-all">
                      {appUrl}/join/{i.code} · {i.role} · expires {fmtDate(i.expiresAt)}
                    </Mono>
                    {!dead ? (
                      <form action={revokeInvite} className="mt-1">
                        <input type="hidden" name="id" value={i.id} />
                        <button className="btn btn-sm">Revoke</button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
              {invites.length === 0 ? <li className="p-3 text-text-3">No invites yet.</li> : null}
            </ul>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
