import { requireTeam } from "@/server/auth";
import { coachInsights } from "@/server/evidence";
import { PageHeader, Section } from "@/components/ui";
import { ProcessHealthCard } from "@/components/tracelab/process-health-card";

export default async function ResearchProofPage() {
  const ctx = await requireTeam();
  const insight = await coachInsights(ctx.team.id);
  const contributionRate = insight.activeMembers ? Math.round((insight.contributorsThisMonth / insight.activeMembers) * 100) : null;
  const testsLinked = Math.max(0, insight.testsWithoutDecision.length ? 0 : 1);

  return <div className="fade-in">
    <PageHeader title="Research proof" subtitle="Live, derived process evidence for the TraceLab study. These are team-level engineering signals — never a student leaderboard and never fabricated before/after results." />

    <section className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ProcessHealthCard label="Decision evidence" value={insight.decisionEvidenceRate == null ? "—" : `${insight.decisionEvidenceRate}%`} explanation="Current share of recorded decisions with accepted supporting evidence." href="/app/decisions" tone={insight.decisionEvidenceRate != null && insight.decisionEvidenceRate >= 70 ? "good" : "attention"} icon="decision" />
      <ProcessHealthCard label="Evidence contributors" value={contributionRate == null ? "—" : `${contributionRate}%`} explanation={`${insight.contributorsThisMonth} of ${insight.activeMembers} active students connected evidence in the last 30 days.`} href="/app/contribution" tone={contributionRate != null && contributionRate >= 60 ? "good" : "attention"} icon="members" />
      <ProcessHealthCard label="Context backlog" value={insight.unresolvedClusters} explanation="Source-event clusters that still need human engineering rationale." href="/app/inbox" tone={insight.unresolvedClusters === 0 ? "good" : "attention"} icon="evidence" />
      <ProcessHealthCard label="Unclosed test loop" value={insight.testsWithoutDecision.length} explanation="Tests that exist but have no downstream decision link yet." href="/app/tests" tone={testsLinked ? "good" : "attention"} icon="test" />
    </section>

    <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
      <Section title="Competition experiment">
        <div className="space-y-4 text-sm leading-6 text-text-2">
          <p><strong className="text-ink">Research question.</strong> Can passive provenance capture plus short student-authored rationale reduce documentation effort while improving retrieval of design rationale and evidence?</p>
          <p><strong className="text-ink">Independent variable.</strong> The TraceLab evidence layer. Keep GitHub, CAD, chat and normal workshop tools unchanged.</p>
          <p><strong className="text-ink">Comparison.</strong> Measure the same team before and after adoption during real build → test → decision cycles.</p>
          <p><strong className="text-ink">Important.</strong> The live cards above describe the current TraceLab dataset. They do not claim causal improvement. Before/after results must be collected separately and reported with sample size and dates.</p>
        </div>
      </Section>
      <Section title="Primary outcome measures">
        <ol className="space-y-2 text-sm text-text-2">
          {["Time to retrieve a 2–3 month old design decision", "Time to locate the test supporting that decision", "Decision evidence-link rate", "Manual documentation time per meaningful engineering change", "Distributed contributor rate", "Portfolio/evidence preparation time"].map((item,index)=><li key={item} className="flex gap-3 rounded-[14px] border border-border bg-canvas p-3"><span className="font-mono text-[9px] text-text-3">M{String(index+1).padStart(2,"0")}</span><span>{item}</span></li>)}
        </ol>
      </Section>
    </div>
  </div>;
}
