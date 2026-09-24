import Link from "next/link";
import { formatTechnicalDate, getSourcePresentation } from "./presentation";
import { TraceIcon } from "./trace-icon";

export interface EvidenceRowProps {
  id: string;
  provider: string;
  eventType: string;
  title: string;
  occurredAt: Date | string;
  actor?: string | null;
  status?: string | null;
  timeZone?: string;
}

export function EvidenceRow({ id, provider, eventType, title, occurredAt, actor, status, timeZone = "UTC" }: EvidenceRowProps) {
  const source = getSourcePresentation(provider, eventType);
  return (
    <li>
      <Link href={`/app/inbox?event=${encodeURIComponent(id)}`} className="group flex min-h-16 items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-muted">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-surface text-text-2 group-hover:text-blueprint">
          <TraceIcon name={source.mark} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="trace-meta mt-1 flex flex-wrap items-center gap-x-1 text-[9px] uppercase text-text-3">
            <span>{source.label}</span><span>·</span><span>{source.eventLabel}</span><span>·</span><span>{formatTechnicalDate(occurredAt, timeZone)}</span>
            {actor ? <><span>·</span><span>{actor}</span></> : null}
          </div>
        </div>
        {status === "inbox" ? <span className="badge">Unlinked</span> : <span aria-hidden className="text-text-3">→</span>}
      </Link>
    </li>
  );
}
