import { PublicFooter, PublicNav } from "@/components/public-chrome";
import { getCurrentUser } from "@/server/auth";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

const SECTIONS: Array<[string, string[]]> = [
  ["Getting started", ["Create a private team (independent or under a school/club organization).", "Pick a competition profile. Student-Owned Mode is on by default.", "Record your first photo or decision from Capture — it works offline.", "Connect GitHub under Integrations; commits arrive in the Evidence Inbox automatically."]],
  ["The evidence model", ["Source events are append-only records from GitHub, Onshape, chat, CSV or capture.", "Iterations group evidence around a meaningful change; tests and decisions attach to them.", "Typed relations (SUPPORTS, TESTS, SUPERSEDES, …) form the Evidence Trace. Machine suggestions are dashed until you accept them.", "Student annotations are versioned; revising never destroys the original."]],
  ["Why? and memory", ["Open any test, decision, iteration or event and press Why? to get a deterministic answer assembled from linked evidence.", "Ask Project History searches across seasons and cites stored objects; it says “not documented” instead of guessing.", "The Failure Library keeps rejected approaches findable for future teams."]],
  ["Competition safety", ["Rules are versioned policy data evaluated on the server for every sensitive action.", "VEX strict blocks generative notebook manipulation. FTC 2026–27 remains under review until the official manual is entered. ISEF blocks protected outputs.", "Exports are pinned to the policy version in force and record student vs. generated content IDs."]],
  ["Roles", ["Students create and own evidence, tests, decisions and reasoning.", "Student leads organize, invite and export.", "Coaches see structural gaps and leave coach notes; they cannot edit student content.", "Organization admins manage teams, retention, billing and audit."]],
];

export default async function DocsPage() {
  const user = await getCurrentUser();
  return (
    <div className="min-h-dvh">
      <PublicNav signedIn={!!user} locale="en" />
      <main id="main" className="mx-auto max-w-3xl px-5 py-14">
        <p className="mono text-xs uppercase tracking-[0.12em] text-text-3">Help</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{brand.productName} documentation</h1>
        <p className="mt-2 text-text-2">Product help for teams. Engineering docs (architecture, data model, security, policy engine, integrations) live in the repository under <code className="mono">docs/</code>.</p>
        {SECTIONS.map(([t, items]) => (
          <section key={t} className="mt-10 border-t border-border pt-5">
            <h2 className="text-lg font-semibold">{t}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-2">
              {items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </section>
        ))}
      </main>
      <PublicFooter />
    </div>
  );
}
