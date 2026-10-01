// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { competitionProfiles } from "@/db/schema";
import { listUserTeams, requireUser } from "@/server/auth";
import { OnboardingForm } from "./onboarding-form";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  const teams = await listUserTeams(user.id);
  const profiles = await db.select().from(competitionProfiles).orderBy(asc(competitionProfiles.name));
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-10">
      <p className="mono text-xs uppercase tracking-[0.12em] text-text-3"><UiText text={brand.productName} /><UiText text="· Set up" /></p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight"><UiText text="Create a private team" /></h1>
      <p className="mt-2 text-sm text-text-2"><UiText text="Only what is necessary. Integrations can be connected later — the product works from your first photo." /></p>
      {teams.length ? (
        <p className="mt-3 text-sm"><UiText text="You already belong to " /><UiText text={teams.length} /><UiText text="team" /><UiText text={teams.length > 1 ? "s" : ""} />.{" "}
          <Link href="/app" className="text-blueprint"><UiText text="Open workspace " /></Link>
        </p>
      ) : null}
      <div className="card mt-6 p-6">
        <OnboardingForm profiles={profiles.map((p) => ({ id: p.id, key: p.key, name: p.name, program: p.program, description: p.description ?? "" }))} defaultLocale={user.locale} />
      </div>
      <div className="card mt-4 p-5 text-sm">
        <h2 className="font-semibold"><UiText text="Joining an existing team?" /></h2>
        <p className="mt-1 text-text-2"><UiText text="Open the invite link your team lead shared, or paste the invite code:" /></p>
        <form action="/join" method="get" className="mt-3 flex gap-2" onSubmit={undefined}>
          <UiElement as="input" name="code" className="input" placeholder="Invite code" aria-label="Invite code" />
          <button className="btn" formAction="/join/redirect"><UiText text="Continue " /></button>
        </form>
      </div>
    </main>
  );
}
