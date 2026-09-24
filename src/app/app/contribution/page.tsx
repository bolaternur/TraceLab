import Link from "next/link";
import { requireTeam } from "@/server/auth";
import { contributionMap } from "@/server/evidence";
import { ExportButton } from "../exports/export-button";
import { PageHeader, Section } from "@/components/ui";

export default async function ContributionPage() {
  const ctx = await requireTeam();
  const c = await contributionMap(ctx.team.id, ctx.user.id);
  const skills: Array<{ name: string; claim: string; strength: number; links: Array<{ href: string; label: string }> }> = [
    { name: "Mechanical design", claim: `${c.cadRevisions} linked CAD revisions across ${c.subsystemsTouched} subsystem${c.subsystemsTouched === 1 ? "" : "s"}`, strength: c.cadRevisions, links: [{ href: "/app/inbox?status=linked", label: "CAD revisions" }] },
    { name: "Experimental design", claim: `${c.tests} structured tests, ${c.quantitativeTests} quantitative`, strength: c.tests, links: [{ href: "/app/tests", label: "Tests" }] },
    { name: "Programming", claim: `${c.commits} commits linked to team evidence`, strength: c.commits, links: [{ href: "/app/inbox?status=linked", label: "Commits" }] },
    { name: "Iteration & decision-making", claim: `${c.decisions} decisions, ${c.decisionsWithEvidence} linked to evidence; ${c.iterations} iterations opened`, strength: c.decisions + c.iterations, links: [{ href: "/app/decisions", label: "Decisions" }] },
    { name: "Documentation", claim: `${c.annotations} student-authored notes and ${c.photos} photos`, strength: c.annotations + c.photos, links: [{ href: "/app/search?type=annotation&q=%20", label: "Notes" }] },
  ];
  return (
    <div className="fade-in">
      <PageHeader title="Contribution Map" subtitle="Private, evidence-backed view of your own work. Not a score, not a ranking, never shown to other students." actions={<ExportButton type="personal_contribution" label="Export my evidence package" />} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Mechanical", `${c.cadRevisions} CAD revisions`, `${c.subsystemsTouched} subsystems`],
          ["Experimentation", `${c.tests} tests`, `${c.quantitativeTests} quantitative`],
          ["Programming", `${c.commits} commits`, "linked to evidence"],
          ["Iteration", `${c.decisions} decisions`, `${c.decisionsWithEvidence} evidence-linked`],
        ].map(([t, a, b]) => (
          <div key={t} className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">{t}</div>
            <div className="mono mt-1 text-xl font-semibold">{a}</div>
            <div className="text-sm text-text-2">{b}</div>
          </div>
        ))}
      </div>
      <Section title="Engineering skill passport (private)">
        <ul className="card divide-y divide-border">
          {skills.map((s) => (
            <li key={s.name} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">{s.name}</div>
                <div className="text-sm text-text-2">{s.strength > 0 ? `Supported by ${s.claim}.` : "No evidence recorded yet."}</div>
              </div>
              <div className="flex gap-2">
                {s.links.map((l) => (
                  <Link key={l.href} href={l.href} className="btn btn-sm">
                    {l.label}
                  </Link>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <p className="hint mt-2">Every claim links to underlying evidence. There is no aggregate “engineering score” by design.</p>
      </Section>
    </div>
  );
}
