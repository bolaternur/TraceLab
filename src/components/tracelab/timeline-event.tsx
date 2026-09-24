import Link from "next/link";
import { TraceIcon } from "./trace-icon";
import { getTimelineVisual, type TimelineKind, type TimelineSourceTone } from "./timeline-model";
import { formatTechnicalDate } from "./presentation";

export interface TimelineEventProps {
  item: {
    id: string;
    at: Date | string;
    kind: TimelineKind | string;
    title: string;
    detail: string;
    href: string;
    tone: TimelineSourceTone | string;
  };
  isLast?: boolean;
  timeZone?: string;
}

const nodeClass = {
  source: "border-blueprint bg-blueprint-bg text-blueprint",
  revision: "border-signal bg-[var(--signal-lime-soft)] text-ink",
  test: "border-test bg-[var(--test-orange-soft)] text-test",
  decision: "border-decision bg-[var(--decision-violet-soft)] text-decision",
  verified: "border-success bg-success-bg text-success",
  failure: "border-danger bg-danger-bg text-danger",
  pending: "border-warning bg-warning-bg text-warning",
  neutral: "border-border-strong bg-surface text-text-2",
} as const;

export function TimelineEvent({ item, isLast = false, timeZone = "UTC" }: TimelineEventProps) {
  const visual = getTimelineVisual(item.kind, item.tone);
  return (
    <li className="relative grid grid-cols-[36px_1fr] gap-3 sm:grid-cols-[46px_1fr]">
      <div className="relative flex justify-center">
        {!isLast ? <span className="trace-line absolute bottom-[-14px] top-9 h-auto" aria-hidden /> : null}
        <span className={`relative z-10 grid h-8 w-8 place-items-center border ${visual.shape === "circle" ? "rounded-full" : visual.shape === "square" ? "rounded-[9px]" : "rotate-45 rounded-[7px]"} ${nodeClass[visual.tone]}`}>
          <span className={visual.shape === "diamond" ? "-rotate-45" : ""}><TraceIcon name={visual.icon} size={15} /></span>
        </span>
      </div>
      <Link href={item.href} className="evidence-card mb-2 block p-3.5 sm:p-4" data-tone={visual.tone}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${visual.tone === "decision" ? "badge-decision" : visual.tone === "test" ? "badge-test" : visual.tone === "verified" ? "badge-success" : visual.tone === "failure" ? "badge-danger" : visual.tone === "revision" ? "badge-signal" : "badge-blueprint"}`}>{visual.label}</span>
              <span className="trace-meta text-[9px] uppercase text-text-3">{formatTechnicalDate(item.at, timeZone)}</span>
            </div>
            <h3 className="mt-2 text-sm font-semibold leading-5 sm:text-[15px]">{item.title}</h3>
            <p className="mt-1 text-xs leading-5 text-text-2">{item.detail}</p>
          </div>
          <span aria-hidden className="mt-1 text-text-3">→</span>
        </div>
      </Link>
    </li>
  );
}
