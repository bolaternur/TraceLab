import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { teamInvites, teams } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { JoinForm } from "./join-form";
import { inviteIsValid } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/auth?mode=signup&invite=${encodeURIComponent(code)}`);
  const rows = await db.select({ inv: teamInvites, team: teams.name }).from(teamInvites).innerJoin(teams, eq(teams.id, teamInvites.teamId)).where(eq(teamInvites.code, code)).limit(1);
  const row = rows[0];
  const valid = row && inviteIsValid(row.inv);
  return (
    <main id="main" className="grid min-h-dvh bg-canvas place-items-center px-4">
      <div className="card w-full max-w-sm p-6">
        {valid ? (
          <>
            <h1 className="text-xl font-semibold">Join {row.team}</h1>
            <p className="mt-1 text-sm text-text-2">
              You were invited as <span className="badge">{row.inv.role.replace("_", " ")}</span>. Team evidence is private to members.
            </p>
            <JoinForm code={code} />
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Invite not available</h1>
            <p className="mt-2 text-sm text-text-2">This invite is invalid, expired, revoked or already used. Ask your team lead for a new one.</p>
          </>
        )}
      </div>
    </main>
  );
}
