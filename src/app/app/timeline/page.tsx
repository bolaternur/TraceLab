// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import Link from "next/link";
import { requireTeam } from "@/server/auth";
import { getActiveSeasonAndProject, listSubsystems, subsystemTimeline } from "@/server/evidence";
import { createSubsystem } from "@/server/actions";
import { EmptyState } from "@/components/ui";
import { WorkspaceFrame } from "@/components/spatial-motion/workspace-frame";
import { buildEngineeringTimelineSnapshot } from "@/components/engineering-timeline/model";
import type { TimelineScale } from "@/components/engineering-timeline/types";
import { TimelineView } from "./timeline-view";

function parseScale(value: string | undefined): TimelineScale {
  if (value === "month" || value === "detail") return value;
  return "day";
}

export default async function TimelinePage({ searchParams }: { searchParams: Promise<{ subsystem?: string; from?: string; to?: string; zoom?: string; focus?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTeam();
  const { project } = await getActiveSeasonAndProject(ctx.team.id);
  const subs = await listSubsystems(ctx.team.id, project?.id);
  const subsystemId = sp.subsystem && subs.some((subsystem) => subsystem.id === sp.subsystem) ? sp.subsystem : null;
  const from = sp.from ? new Date(sp.from) : undefined;
  const to = sp.to ? new Date(sp.to) : undefined;
  const items = await subsystemTimeline(ctx.team.id, subsystemId, {
    from: from && !Number.isNaN(from.getTime()) ? from : undefined,
    to: to && !Number.isNaN(to.getTime()) ? to : undefined,
  });
  const scale = parseScale(sp.zoom);
  const snapshot = buildEngineeringTimelineSnapshot({ items, timeZone: ctx.team.timezone, subsystemId });
  const focusedId = sp.focus && snapshot.entries.some((entry) => entry.id === sp.focus) ? sp.focus : null;
  const graphHref = `/app/graph${subsystemId ? `?subsystem=${encodeURIComponent(subsystemId)}` : ""}`;

  return (
    <WorkspaceFrame title="Engineering Timeline" href={graphHref} linkLabel="Trace graph" controls={(
        <UiElement as="section" className="mb-4 rounded-[20px] border border-border-subtle bg-surface p-3 sm:p-4" aria-label="Timeline filters">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink"><UiText text="Shape the time surface" /></p>
              <p className="mt-0.5 text-xs text-text-3"><UiText text="Filter by subsystem or date. Scale changes time density and source-event aggregation — not card size." /></p>
            </div>
            <span className="trace-meta text-[10px] uppercase text-text-3"><UiText text={snapshot.entries.length} /><UiText text="recorded objects" /></span>
          </div>

          <div className="mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
            <Link href="/app/timeline" className={`trace-chip min-h-9 shrink-0 px-3 normal-case tracking-normal ${!subsystemId ? "!border-blueprint !bg-blueprint-bg !font-semibold !text-blueprint" : ""}`}><UiText text="All systems" /></Link>
            {subs.map((subsystem) => (
              <Link key={subsystem.id} href={`/app/timeline?subsystem=${subsystem.id}`} className={`trace-chip min-h-9 shrink-0 px-3 normal-case tracking-normal ${subsystemId === subsystem.id ? "!border-blueprint !bg-blueprint-bg !font-semibold !text-blueprint" : ""}`}>
                {subsystem.name}
              </Link>
            ))}
            {ctx.canOrganize ? (
              <form action={createSubsystem} className="ml-auto hidden items-center gap-1 xl:flex">
                <UiElement as="input" name="name" className="input !min-h-9 !w-40 text-sm" placeholder="New subsystem" required aria-label="New subsystem name" />
                <button className="trace-button min-h-9 px-3"><UiText text="Add" /></button>
              </form>
            ) : null}
          </div>

          <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-end" method="get">
            {subsystemId ? <input type="hidden" name="subsystem" value={subsystemId} /> : null}
            <label>
              <span className="label"><UiText text="From" /></span>
              <input type="date" name="from" className="input !min-h-10" defaultValue={sp.from ?? ""} />
            </label>
            <label>
              <span className="label"><UiText text="To" /></span>
              <input type="date" name="to" className="input !min-h-10" defaultValue={sp.to ?? ""} />
            </label>
            <label>
              <span className="label"><UiText text="Scale" /></span>
              <select name="zoom" className="select !min-h-10 !w-auto" defaultValue={scale}>
                <option value="month"><UiText text="Month" /></option>
                <option value="day"><UiText text="Day" /></option>
                <option value="detail"><UiText text="Detail" /></option>
              </select>
            </label>
            <button className="trace-button trace-button-primary min-h-10 px-4"><UiText text="Apply" /></button>
            {(subsystemId || sp.from || sp.to || sp.zoom) ? <Link href="/app/timeline" className="trace-button min-h-10 px-4"><UiText text="Reset" /></Link> : null}
          </form>
        </UiElement>
    )}>


        {snapshot.entries.length === 0 ? (
          <EmptyState title="No history in this range" body="Source evidence, tests, decisions and iteration milestones will appear here as the project develops." />
        ) : (
          <TimelineView snapshot={snapshot} initialScale={scale} initialSelectedId={focusedId} />
        )}

    </WorkspaceFrame>
  );
}
