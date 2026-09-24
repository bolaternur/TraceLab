import Link from "next/link";
import type { ReactNode } from "react";
import { TraceIcon } from "@/components/tracelab/trace-icon";

interface ProcessHealthCardProps {
  label: string;
  value: ReactNode;
  explanation: string;
  href?: string;
  tone?: "good" | "attention" | "neutral";
  icon?: string;
}

export function ProcessHealthCard({ label, value, explanation, href, tone = "neutral", icon = "evidence" }: ProcessHealthCardProps) {
  const accent = tone === "good" ? "var(--verified-green)" : tone === "attention" ? "var(--pending-yellow)" : "var(--trace-blue)";
  const body = (
    <article className="relative h-full overflow-hidden rounded-[18px] border border-border bg-surface p-4">
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: accent }} aria-hidden />
      <div className="flex items-start justify-between gap-3 pl-1">
        <div className="min-w-0">
          <div className="trace-meta text-[9px] uppercase text-text-3">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-ink">{value}</div>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-canvas text-text-2"><TraceIcon name={icon} size={17} /></span>
      </div>
      <p className="mt-3 pl-1 text-xs leading-5 text-text-2">{explanation}</p>
      {href ? <span className="mt-3 block pl-1 text-xs font-semibold text-blueprint">Review evidence →</span> : null}
    </article>
  );
  return href ? <Link href={href} className="block h-full focus-visible:rounded-[18px]">{body}</Link> : body;
}
