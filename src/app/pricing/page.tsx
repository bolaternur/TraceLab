// locale-wired
import { UiText } from "@/components/locale-provider";
import Link from "next/link";
import { PublicFooter, PublicNav } from "@/components/public-chrome";
import { getCurrentUser } from "@/server/auth";
import { PLANS } from "@/modules/billing/entitlements";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-dvh">
      <PublicNav signedIn={!!user} locale="en" />
      <main id="main" className="mx-auto max-w-6xl px-5 py-14">
        <h1 className="text-3xl font-semibold tracking-tight"><UiText text="Pricing" /></h1>
        <p className="mt-2 text-text-2"><UiText text="Core capture, evidence, exports and competition safety are free. Paid plans add organization scale." /></p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((k) => {
            const p = PLANS[k];
            return (
              <div key={k} className={`card p-6 ${k === "club" ? "border-blueprint" : ""}`}>
                <h2 className="text-lg font-semibold"><UiText text={p.name} /></h2>
                <div className="mono mt-1 text-2xl"><UiText text={p.price} /></div>
                <ul className="mt-4 space-y-2 text-sm text-text-2">
                  <li><UiText text="Teams: " /><UiText text={p.maxTeams === Infinity ? "unlimited" : p.maxTeams} /></li>
                  <li><UiText text="Storage: " /><UiText text={p.storageGb} /><UiText text="GB" /></li>
                  <li><UiText text="Seasons archived: " /><UiText text={p.maxSeasons === Infinity ? "unlimited" : p.maxSeasons} /></li>
                  {p.features.map((f) => (
                    <li key={f}>✓ <UiText text={f} /></li>
                  ))}
                </ul>
                <Link href={user ? "/app/org" : "/auth?mode=signup"} className={`btn mt-6 w-full ${k === "club" ? "btn-primary" : ""}`}>
                  <UiText text={k === "free" ? "Start free" : "Choose plan"} />
                </Link>
              </div>
            );
          })}
        </div>
        <div className="card mt-8 p-5 text-sm text-text-2">
          <strong className="text-ink"><UiText text="Never paywalled:" /></strong><UiText text="privacy controls, personal and team data export, competition-policy gating, Student-Owned Mode. " />{process.env.STRIPE_SECRET_KEY ? null : <span className="ml-1"><UiText text="Billing provider is not configured in this deployment; plan changes use the development adapter." /></span>}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
