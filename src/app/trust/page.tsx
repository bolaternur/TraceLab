import { PublicFooter, PublicNav } from "@/components/public-chrome";
import { getCurrentUser } from "@/server/auth";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

export default async function TrustPage() {
  const user = await getCurrentUser();
  const items: Array<[string, string]> = [
    ["Private by default", "Every team's evidence is visible only to verified active members of that team. Nothing is public unless an authorized person deliberately exports it."],
    ["Student ownership", "Student-authored reasoning is stored with explicit provenance and version history. Coaches and administrators cannot edit or overwrite it — the server refuses, not just the UI."],
    ["AI provenance", "Source evidence, student annotations, deterministic system data, machine suggestions and AI-generated text are stored as distinct, labeled objects. AI output is logged with policy version, model and hash, and never silently replaces student text."],
    ["Competition policy gating", "Competition rules are versioned data evaluated server-side for every sensitive action. Strict profiles block generative notebook manipulation. Seasons whose rules have not been reviewed fail safe: risky actions remain disabled. We do not claim official certification by any competition organizer."],
    ["Data export & deletion", "Students can export their own contribution evidence. Team leads can export team data. Organization admins can export or delete an organization with confirmation and an audit trail. These controls are never paywalled."],
    ["No public productivity ranking", "We never rank students by commits, entries, uploads, time or 'XP'. Contribution maps are private, evidence-backed and never comparative."],
    ["Integration permissions", "GitHub ingests commit metadata only (SHA, author, message, changed-file counts) — not repository contents. CAD connectors record that a design changed, not why. Connector secrets are encrypted at rest and webhooks are signature-verified."],
    ["Photo privacy", "Uploaded JPEGs have EXIF/GPS and device metadata stripped. Media is served only through membership-checked, non-guessable, private URLs."],
    ["Security model", "Scrypt password hashing, httpOnly session cookies, server-side authorization on every team-scoped request, idempotent webhooks, content-type sniffing and size limits on uploads, structured audit events for sensitive actions. See SECURITY.md in the repository for the threat model."],
    ["Youth privacy", "We collect minimal personal data (email, display name, optional age category). No behavioral advertising, no precise location, no hidden tracking, no public minor profiles. Legal compliance for a given jurisdiction requires review by your organization; we provide the controls."],
  ];
  return (
    <div className="min-h-dvh">
      <PublicNav signedIn={!!user} locale="en" />
      <main id="main" className="mx-auto max-w-3xl px-5 py-14">
        <p className="mono text-xs uppercase tracking-[0.12em] text-text-3">Trust center</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">How {brand.productName} protects student engineering work</h1>
        <p className="mt-3 text-text-2">Plain statements about what the product does — and does not — do. Policy snapshot date: {brand.policySnapshotDate}.</p>
        <dl className="mt-10 space-y-8">
          {items.map(([t, b]) => (
            <div key={t} className="border-t border-border pt-5">
              <dt className="font-semibold">{t}</dt>
              <dd className="mt-1 text-sm text-text-2">{b}</dd>
            </div>
          ))}
        </dl>
      </main>
      <PublicFooter />
    </div>
  );
}
