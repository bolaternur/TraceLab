import Link from "next/link";
import type { TodaySummaryItem } from "./today-model";

export interface ProcessStripProps {
  items: TodaySummaryItem[];
}

const toneClass: Record<TodaySummaryItem["tone"], string> = {
  action: "text-blueprint",
  neutral: "text-text-2",
  test: "text-test",
  decision: "text-decision",
};

export function ProcessStrip({ items }: ProcessStripProps) {
  return (
    <div className="grid divide-y divide-border overflow-hidden rounded-[18px] border border-border bg-surface sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
      {items.map((item) => (
        <Link key={item.label} href={item.href} className="flex min-h-20 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/70">
          <div>
            <div className="text-xs font-medium text-text-3">{item.label}</div>
            <div className={`mono mt-1 text-xl font-semibold ${toneClass[item.tone]}`}>{item.value}</div>
          </div>
          <span aria-hidden className="text-text-3">→</span>
        </Link>
      ))}
    </div>
  );
}
