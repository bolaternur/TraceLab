import Link from "next/link";
import { getSourcePresentation, formatTechnicalDate } from "./presentation";
import { TraceIcon } from "./trace-icon";

export interface MissingContextCardProps {
  id: string;
  provider: string;
  eventType: string;
  title: string;
  occurredAt: Date | string;
  actor?: string | null;
  subsystem?: string | null;
  timeZone?: string;
}

function actionCopy(provider: string, eventType: string) {
  if (provider === "github" && ["commit", "push"].includes(eventType)) return "Add the why";
  if (provider === "onshape") return "Explain this revision";
  if (eventType === "photo") return "Describe what changed";
  return "Add context";
}

export function MissingContextCard({ id, provider, eventType, title, occurredAt, actor, subsystem, timeZone = "UTC" }: MissingContextCardProps) {
  const source = getSourcePresentation(provider, eventType);
  return (
    <article className="evidence-card group p-4 sm:p-5" data-tone="source">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blueprint-bg text-blueprint">
            <TraceIcon name={source.mark} size={18} />
          </span>
          <div className="min-w-0">
            <div className="trace-meta flex flex-wrap items-center gap-x-1.5 text-[10px] uppercase text-text-3">
              <span>{source.label}</span>
              <span aria-hidden>·</span>
              <span>{source.eventLabel}</span>
              <span aria-hidden>·</span>
              <span>{formatTechnicalDate(occurredAt, timeZone)}</span>
            </div>
            <h3 className="mt-1 line-clamp-2 text-[15px] font-semibold leading-5 text-ink">{title}</h3>
          </div>
        </div>
        <span className="badge badge-signal shrink-0">Needs context</span>
      </div>

      <div className="mt-4 rounded-[14px] bg-canvas px-3.5 py-3">
        <p className="text-[15px] font-semibold leading-5">Why did you make this change?</p>
        <p className="mt-1 text-xs leading-5 text-text-3">The source tells us what changed. Only your team can preserve why.</p>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 text-xs text-text-3">
          {subsystem ? <span className="font-medium text-text-2">{subsystem}</span> : <span>Subsystem not linked yet</span>}
          {actor ? <span> · {actor}</span> : null}
        </div>
        <Link href={`/app/context/${encodeURIComponent(id)}`} className="trace-button trace-button-primary min-h-10 rounded-full px-4">
          {actionCopy(provider, eventType)}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
