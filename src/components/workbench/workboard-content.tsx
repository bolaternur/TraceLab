// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import Link from "next/link";
import { DecisionState, OutcomeBadge, SourceBadge, fmtDate } from "@/components/ui";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import type { WorkboardKind, WorkbenchSnapshot } from "./types";

export interface WorkboardPresentation {
  eyebrow: string;
  title: string;
  summary: string;
  count?: number;
}

export function getWorkboardPresentation(kind: WorkboardKind, snapshot: WorkbenchSnapshot): WorkboardPresentation {
  switch (kind) {
    case "needs-context":
      return { eyebrow: "Human context", title: "Needs your context", summary: "Source facts are already captured. Add only the engineering reason the tools cannot know.", count: snapshot.counts.needsContext };
    case "active-iteration":
      return { eyebrow: "Current build loop", title: "Active iteration", summary: "The part of the project currently moving from change to evidence to decision.", count: snapshot.activeIterations.length };
    case "recent-evidence":
      return { eyebrow: "Source evidence", title: "Recent evidence", summary: "Work arriving from code, CAD, capture and tests without rewriting it into a notebook.", count: snapshot.recentEvidence.length };
    case "test-bench":
      return { eyebrow: "Validation", title: "Test bench", summary: "What was tested, what happened, and what decision the result should inform.", count: snapshot.counts.tests };
    case "decision-trail":
      return { eyebrow: "Engineering choice", title: "Decision trail", summary: "The latest keep, iterate, reject and defer decisions with their evidence path.", count: snapshot.counts.decisions };
    case "process-health":
      return { eyebrow: "Trust & continuity", title: "Process health", summary: "Policy, provenance and evidence gaps that could break the engineering record." };
  }
}

function EmptyBoard({ children }: { children: import("react").ReactNode }) {
  return <div className="workbench-empty-artboard"><span className="h-2 w-2 rounded-full bg-black/12" aria-hidden /><p><UiText text={children} /></p></div>;
}

function NeedsContextBoard({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  const [primary, ...queue] = snapshot.needsContext;
  if (!primary) return <EmptyBoard><UiText text="Nothing is waiting for human rationale. Automatic sources are caught up." /></EmptyBoard>;
  return (
    <div className="space-y-3">
      <div className="workbench-context-focus">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge provider={primary.provider} eventType={primary.eventType} />
          <span className="mono text-[10px] text-black/38">{fmtDate(primary.occurredAt, true)}</span>
        </div>
        <h3 className="mt-3 line-clamp-2 text-[17px] font-semibold leading-[1.25] tracking-[-0.02em] text-[#111315]">{primary.title}</h3>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Link href={`/app/context/${primary.id}`} className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[10px] bg-[#111315] px-3 text-xs font-semibold text-white">
            <TraceIcon name="reflection" size={14} /><UiText text="Add the why " /></Link>
        </div>
      </div>
      {queue.length ? (
        <UiElement as="div" className="workbench-context-queue" aria-label="More evidence needing context">
          {queue.slice(0, 3).map((item) => (
            <Link key={item.id} href={`/app/context/${item.id}`} className="workbench-context-chip">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--trace-blue)]" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.title}</span>
            </Link>
          ))}
        </UiElement>
      ) : null}
    </div>
  );
}

function ActiveIterationBoard({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  const iteration = snapshot.activeIterations[0];
  if (!iteration) return <EmptyBoard><UiText text="No active iteration. Open one when a concrete engineering change begins." /></EmptyBoard>;
  const primaryContext = snapshot.needsContext[0];
  const recentTest = snapshot.recentTests[0];
  const recentDecision = snapshot.recentDecisions[0];
  return (
    <div className="space-y-5">
      <div>
        <Link href={`/app/iterations/${iteration.id}`} className="mt-2 block max-w-[430px] text-[26px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#111315] hover:underline">{iteration.title}</Link>
        <p className="mt-2 mono text-[9px] uppercase tracking-[0.05em] text-black/34"><UiText text="Opened " />{fmtDate(iteration.openedAt)}</p>
      </div>

      <UiElement as="div" className="workbench-loop-trace" aria-label="Current engineering evidence loop">
        <div className="workbench-loop-step" data-state="source">
          <span className="workbench-loop-node"><TraceIcon name="evidence" size={14} /></span>
          <div><strong><UiText text="Source" /></strong><span><UiText text={snapshot.recentEvidence.length ? `${snapshot.recentEvidence.length} recent` : "Waiting"} /></span></div>
        </div>
        <span className="workbench-loop-connector" aria-hidden>→</span>
        <div className="workbench-loop-step" data-state="why">
          <span className="workbench-loop-node"><TraceIcon name="reflection" size={14} /></span>
          <div><strong><UiText text="Why" /></strong><span><UiText text={snapshot.counts.needsContext ? `${snapshot.counts.needsContext} missing` : "Captured"} /></span></div>
        </div>
        <span className="workbench-loop-connector" aria-hidden>→</span>
        <div className="workbench-loop-step" data-state="test">
          <span className="workbench-loop-node"><TraceIcon name="test" size={14} /></span>
          <div><strong><UiText text="Test" /></strong><span><UiText text={recentTest ? recentTest.outcome ?? "Recorded" : "Next"} /></span></div>
        </div>
        <span className="workbench-loop-connector" aria-hidden>→</span>
        <div className="workbench-loop-step" data-state="decision">
          <span className="workbench-loop-node"><TraceIcon name="decision" size={14} /></span>
          <div><strong><UiText text="Decision" /></strong><span><UiText text={recentDecision ? recentDecision.disposition : "Pending"} /></span></div>
        </div>
      </UiElement>

      <div className="workbench-iteration-evidence-strip">
        <div><span className="trace-meta"><UiText text="Human context" /></span><strong><UiText text={primaryContext ? primaryContext.title : "No rationale gap"} /></strong></div>
        <div><span className="trace-meta"><UiText text="Latest validation" /></span><strong>{recentTest ? recentTest.title : "No test linked yet"}</strong></div>
        <div><span className="trace-meta"><UiText text="Latest choice" /></span><strong><UiText text={recentDecision ? recentDecision.title : "Decision still open"} /></strong></div>
      </div>

      <Link href={`/app/iterations/${iteration.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3157eb]"><UiText text="Open iteration " /><span aria-hidden>↗</span></Link>
    </div>
  );
}

function RecentEvidenceBoard({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  if (!snapshot.recentEvidence.length) return <EmptyBoard><UiText text="GitHub, CAD, photo and capture events will appear here as source evidence." /></EmptyBoard>;
  return (
    <div className="workbench-evidence-tiles">
      {snapshot.recentEvidence.slice(0, 4).map((item, index) => (
        <Link key={item.id} href={`/app/inbox?event=${item.id}`} className="workbench-evidence-tile" data-featured={index === 0 ? "true" : "false"}>
          <span className="workbench-evidence-glyph"><TraceIcon name={item.provider === "github" ? "branch" : item.provider === "onshape" ? "cad" : item.eventType === "photo" ? "photo" : "evidence"} size={14} /></span>
          <span className="min-w-0"><strong className="block line-clamp-2 text-sm leading-5 text-ink">{item.title}</strong><span className="mt-1 block text-xs text-text-3">{fmtDate(item.occurredAt, true)}</span></span>
        </Link>
      ))}
    </div>
  );
}

function TestBenchBoard({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  if (!snapshot.recentTests.length) return <EmptyBoard>{snapshot.counts.tests ? `${snapshot.counts.tests} tests were recorded this week. Open Tests to review them.` : "No tests yet. Connect a change to an observed result before deciding."}</EmptyBoard>;
  return (
    <div>
      <div className="workbench-test-tiles">
        {snapshot.recentTests.slice(0, 3).map((test, index) => (
          <Link key={test.id} href={`/app/tests/${test.id}`} className="workbench-test-tile" data-featured={index === 0 ? "true" : "false"}>
            <div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#111315]">{test.title}</span><OutcomeBadge outcome={test.outcome} /></div>
            <div className="mt-3 flex items-end justify-between gap-3"><span className="mono text-[8px] uppercase tracking-[0.04em] text-black/34">{fmtDate(test.performedAt)}</span><strong className="mono text-[16px] tracking-[-0.03em]">{test.trials != null && test.successes != null ? `${test.successes}/${test.trials}` : test.value != null ? `${test.value}${test.units ? ` ${test.units}` : ""}` : "QUAL"}</strong></div>
          </Link>
        ))}
      </div>
      <Link href="/app/tests" className="mt-3 inline-flex text-xs font-semibold text-[#3157eb]"><UiText text="Open all tests ↗" /></Link>
    </div>
  );
}

function DecisionTrailBoard({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  if (!snapshot.recentDecisions.length) return <EmptyBoard>{snapshot.counts.decisions ? `${snapshot.counts.decisions} decisions were recorded this week.` : "No decision recorded yet. Decisions should follow evidence, not activity."}</EmptyBoard>;
  return (
    <div>
      <div className="workbench-decision-tiles">
        {snapshot.recentDecisions.slice(0, 3).map((decision, index) => (
          <Link key={decision.id} href={`/app/decisions/${decision.id}`} className="workbench-decision-tile" data-featured={index === 0 ? "true" : "false"}>
            <div className="flex items-start gap-2"><span className="min-w-0 flex-1 line-clamp-2 text-[11px] font-semibold leading-4 text-[#111315]">{decision.title}</span><DecisionState disposition={decision.disposition} /></div>
            <div className="mt-2 mono text-[8px] uppercase tracking-[0.04em] text-black/32">{fmtDate(decision.decidedAt)}</div>
          </Link>
        ))}
      </div>
      <Link href="/app/decisions" className="mt-3 inline-flex text-xs font-semibold text-[#3157eb]"><UiText text="Open decision trail ↗" /></Link>
    </div>
  );
}

function ProcessHealthBoard({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  const policyOk = snapshot.policy.status === "clear";
  return (
    <div>
      <div className="workbench-health-grid">
        <div className="workbench-health-cell"><span><UiText text="Policy" /></span><strong className={policyOk ? "text-[#378a62]" : "text-[#9b6a00]"}><UiText text={policyOk ? "Clear" : "Review"} /></strong></div>
        <div className="workbench-health-cell"><span><UiText text="Unlinked" /></span><strong className="mono"><UiText text={snapshot.counts.inbox} /></strong></div>
        <div className="workbench-health-cell"><span><UiText text="Authorship" /></span><strong className="text-[#378a62]"><UiText text="Preserved" /></strong></div>
        <div className="workbench-health-cell"><span><UiText text="Workspace" /></span><strong><UiText text="Private" /></strong></div>
      </div>
      <Link href="/app/competition" className="mt-3 inline-flex text-xs font-semibold text-[#3157eb]"><UiText text="Review policy ↗" /></Link>
    </div>
  );
}

export function WorkboardContent({ kind, snapshot }: { kind: WorkboardKind; snapshot: WorkbenchSnapshot }) {
  switch (kind) {
    case "needs-context": return <NeedsContextBoard snapshot={snapshot} />;
    case "active-iteration": return <ActiveIterationBoard snapshot={snapshot} />;
    case "recent-evidence": return <RecentEvidenceBoard snapshot={snapshot} />;
    case "test-bench": return <TestBenchBoard snapshot={snapshot} />;
    case "decision-trail": return <DecisionTrailBoard snapshot={snapshot} />;
    case "process-health": return <ProcessHealthBoard snapshot={snapshot} />;
  }
}
