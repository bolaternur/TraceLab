import { TimelineEvent, type TimelineEventProps } from "./timeline-event";

export interface TimelineGroupProps {
  label: string;
  items: TimelineEventProps["item"][];
  timeZone?: string;
}

export function TimelineGroup({ label, items, timeZone = "UTC" }: TimelineGroupProps) {
  return (
    <li className="grid gap-3 lg:grid-cols-[150px_1fr]">
      <div className="lg:pt-1">
        <div className="trace-meta sticky top-3 inline-flex rounded-full border border-border bg-canvas px-2.5 py-1 text-[9px] font-semibold uppercase text-text-3 md:top-4">{label}</div>
      </div>
      <ol>
        {items.map((item, index) => <TimelineEvent key={item.id} item={item} isLast={index === items.length - 1} timeZone={timeZone} />)}
      </ol>
    </li>
  );
}
