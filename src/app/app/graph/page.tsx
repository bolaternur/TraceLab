// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import Link from "next/link";
import { requireTeam } from "@/server/auth";
import { evidenceGraph, getActiveSeasonAndProject, listSubsystems } from "@/server/evidence";
import { EmptyState } from "@/components/ui";
import { WorkspaceFrame } from "@/components/spatial-motion/workspace-frame";
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
    <WorkspaceFrame title="Evidence Trace" href={"/app/timeline"} linkLabel="Timeline" controls={(
        <UiElement as="section" className="mb-4 rounded-[20px] border border-border-subtle bg-surface p-3 sm:p-4" aria-label="Trace filters">
          <form className="flex flex-wrap gap-2 text-sm" method="get">
            <UiElement as="select" name="subsystem" className="select !min-h-10 !w-auto rounded-full" defaultValue={subsystemId ?? ""} aria-label="Subsystem">
              <option value=""><UiText text="All subsystems" /></option>
              {subs.map((subsystem) => <option key={subsystem.id} value={subsystem.id}>{subsystem.name}</option>)}
            </UiElement>
            <UiElement as="select" name="relation" className="select !w-auto" defaultValue={sp.relation ?? ""} aria-label="Relation type">
              <option value=""><UiText text="All relations" /></option>
              {relationTypes.map(relation => <option key={relation} value={relation}><UiText text={relation} /></option>)}
            </UiElement>
            <UiElement as="select" name="days" className="select !w-auto" defaultValue={sp.days ?? ""} aria-label="Date range">
              <option value=""><UiText text="All time" /></option>
              <option value="7"><UiText text="Last 7 days" /></option>
              <option value="30"><UiText text="Last 30 days" /></option>
              <option value="90"><UiText text="Last 90 days" /></option>
            </UiElement>
            <button className="btn btn-primary"><UiText text="Apply" /></button>
            <Link href="/app/graph" className="btn"><UiText text="Reset" /></Link>
          </form>
          {clipped > 0 && <p className="mt-3 text-sm text-text-2">{clipped} <UiText text="additional objects are hidden in this overview. Narrow the trace instead of turning it into visual spaghetti." /></p>}
        </UiElement>
    )}>


        {snapshot.nodes.length === 0 ? (
          <EmptyState title="No linked evidence yet" body="Link source events to an iteration, record a test, and connect a decision. The trace appears from those real relationships — never from invented AI structure." />
        ) : (
          <GraphView snapshot={snapshot} initialSelectedId={focusedId} storageKey={"tracelab:graph:" + ctx.team.id + ":" + ctx.user.id} canConnect={ctx.canAuthorStudentContent} />
        )}

    </WorkspaceFrame>
  );
}
