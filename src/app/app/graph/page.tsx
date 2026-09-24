import Link from "next/link";
import { requireTeam } from "@/server/auth";
import { evidenceGraph, getActiveSeasonAndProject, listSubsystems } from "@/server/evidence";
import { EmptyState, PageHeader } from "@/components/ui";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { buildEvidenceTraceSnapshot } from "@/components/evidence-trace/model";
import { GraphView } from "./graph-view";
import { daysAgo } from "@/lib/time";

const DEFAULT_NODE_LIMIT = 30;

export default async function GraphPage({ searchParams }: { searchParams: Promise<{ subsystem?: string; relation?: string; days?: string; focus?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTeam();
  const { project } = await getActiveSeasonAndProject(ctx.team.id);
  const subs = await listSubsystems(ctx.team.id, project?.id);
  const subsystemId = sp.subsystem && subs.some((s) => s.id === sp.subsystem) ? sp.subsystem : null;
  const g = await evidenceGraph(ctx.team.id, { subsystemId });
  const days = sp.days ? Number(sp.days) : null;
  const since = days && Number.isFinite(days) ? daysAgo(days).getTime() : null;
  const allNodes = g.nodes.filter((node) => !since || !node.date || node.date.getTime() >= since);
  const nodes = allNodes.slice(0, 30);
  const ids = new Set(nodes.map((node) => node.id));
  const edges = g.edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to) && (!sp.relation || edge.type === sp.relation));
  const relationTypes = [...new Set(g.edges.map((edge) => edge.type))].sort();
  const clipped = Math.max(0, allNodes.length - DEFAULT_NODE_LIMIT);
  const snapshot = buildEvidenceTraceSnapshot({ nodes, edges });
  const focusedId = sp.focus && snapshot.nodes.some((node) => node.id === sp.focus) ? sp.focus : null;

  return (
    <div className="fade-in min-h-full pb-10">
      <div className="mx-auto w-full max-w-[1680px]">
        <PageHeader
          title="Evidence Trace"
          subtitle="Follow the real path from source evidence through iteration and test to a decision. The canvas is read-only: relationships come from stored evidence, never invented structure."
          actions={
            <Link href="/app/timeline" className="trace-button min-h-10 rounded-full px-4 text-sm">
              <TraceIcon name="timeline" size={16} />
              Open in timeline
            </Link>
          }
        />

        <section className="mb-4 rounded-[20px] border border-border-subtle bg-surface p-3 sm:p-4" aria-label="Trace filters">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">Focus the trace</p>
              <p className="mt-0.5 text-xs text-text-3">Keep the canvas readable. Narrow by subsystem, relationship or time before expanding the evidence field.</p>
            </div>
            <span className="trace-meta text-[10px] uppercase text-text-3">{snapshot.nodes.length} objects · {snapshot.relations.length} relations</span>
          </div>
          <form className="flex flex-wrap gap-2 text-sm" method="get">
            <select name="subsystem" className="select !min-h-10 !w-auto rounded-full" defaultValue={subsystemId ?? ""} aria-label="Subsystem">
              <option value="">All subsystems</option>
              {subs.map((subsystem) => <option key={subsystem.id} value={subsystem.id}>{subsystem.name}</option>)}
            </select>
            <select name="relation" className="select !min-h-10 !w-auto rounded-full" defaultValue={sp.relation ?? ""} aria-label="Relation type">
              <option value="">All relations</option>
              {relationTypes.map((relation) => <option key={relation}>{relation}</option>)}
            </select>
            <select name="days" className="select !min-h-10 !w-auto rounded-full" defaultValue={sp.days ?? ""} aria-label="Date range">
              <option value="">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button className="trace-button trace-button-primary min-h-10 rounded-full px-4">Apply</button>
            {(subsystemId || sp.relation || sp.days) ? <Link href="/app/graph" className="trace-button min-h-10 rounded-full px-4">Reset</Link> : null}
          </form>
          {clipped ? (
            <p className="mt-3 rounded-[12px] bg-canvas px-3 py-2 text-xs leading-5 text-text-2">
              {clipped} additional objects are hidden in this overview. Narrow the trace instead of turning it into visual spaghetti.
            </p>
          ) : null}
        </section>

        {snapshot.nodes.length === 0 ? (
          <EmptyState title="No linked evidence yet" body="Link source events to an iteration, record a test, and connect a decision. The trace appears from those real relationships — never from invented AI structure." />
        ) : (
          <GraphView snapshot={snapshot} initialSelectedId={focusedId} />
        )}
      </div>
    </div>
  );
}
