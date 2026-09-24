import Link from "next/link";
import type { ReactNode } from "react";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { getSourcePresentation } from "@/components/tracelab/presentation";

// ---------------------------------------------------------------------------
// Source identity: TraceLab icon + label, never color alone.
// ---------------------------------------------------------------------------
export function SourceBadge({ provider, eventType }: { provider: string; eventType?: string }) {
  const source = getSourcePresentation(provider, eventType);
  return (
    <span className="badge gap-1.5" data-tone={source.tone} title={`${source.label}${eventType ? " · " + source.eventLabel : ""}`}>
      <TraceIcon name={source.mark} size={13} />
      {source.label}
      {eventType ? <span className="opacity-70 normal-case tracking-normal">· {source.eventLabel}</span> : null}
    </span>
  );
}

const PROVENANCE: Record<string, { label: string; cls: string }> = {
  student: { label: "Student-authored", cls: "badge-teal" },
  source: { label: "Source evidence", cls: "badge" },
  system: { label: "System", cls: "badge" },
  suggestion: { label: "Suggestion", cls: "badge-warning" },
  ai: { label: "AI-generated", cls: "badge-danger" },
};

export function ProvenanceLabel({ kind }: { kind: string }) {
  const p = PROVENANCE[kind] ?? PROVENANCE.system;
  return <span className={`badge ${p.cls}`}>{p.label}</span>;
}

export function PolicyBadge({ decision }: { decision: string }) {
  const cls = decision === "ALLOW" ? "badge-success" : decision === "ALLOW_WITH_DISCLOSURE" ? "badge-teal" : decision === "BLOCK" ? "badge-danger" : "badge-warning";
  const glyph = decision === "ALLOW" ? "✓" : decision === "BLOCK" ? "✕" : "!";
  return (
    <span className={`badge ${cls}`}>
      <span aria-hidden>{glyph}</span>
      {decision.replace(/_/g, " ")}
    </span>
  );
}

export function DecisionState({ disposition }: { disposition: string }) {
  const cls = disposition === "keep" ? "badge-success" : disposition === "reject" || disposition === "revert" ? "badge-danger" : disposition === "iterate" ? "badge-blueprint" : disposition === "defer" ? "badge-warning" : "badge";
  return <span className={`badge ${cls}`}>{disposition}</span>;
}

export function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="badge">open</span>;
  const cls = outcome === "pass" || outcome === "kept" ? "badge-success" : outcome === "fail" || outcome === "rejected" || outcome === "reverted" ? "badge-danger" : outcome === "deferred" ? "badge-warning" : "badge";
  return <span className={`badge ${cls}`}>{outcome}</span>;
}

export function TestResult({ trials, successes, value, units, outcome }: { trials: number | null; successes: number | null; value: string | null; units: string | null; outcome: string }) {
  if (trials != null && successes != null) {
    const pct = trials > 0 ? Math.round((successes / trials) * 100) : 0;
    return (
      <div className="flex items-center gap-3">
        <span className="mono text-lg font-semibold">
          {successes} / {trials}
        </span>
        <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={`${pct}% success`}>
          <div className={`h-full ${outcome === "pass" ? "bg-success" : outcome === "fail" ? "bg-danger" : "bg-blueprint"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="mono text-xs text-text-3">{pct}%</span>
      </div>
    );
  }
  if (value != null)
    return (
      <span className="mono text-lg font-semibold">
        {value}
        {units ? <span className="ml-1 text-sm text-text-3">{units}</span> : null}
      </span>
    );
  return <span className="text-sm text-text-2">Qualitative</span>;
}

export function Metric({ label, value, hint, href }: { label: string; value: ReactNode; hint?: string; href?: string }) {
  const body = (
    <div className="card p-4">
      <div className="mono text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-text-2">{label}</div>
      {hint ? <div className="hint mt-1">{hint}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[22px] border border-dashed border-border-default bg-canvas px-5 py-6 sm:px-6">
      <div className="h-1.5 w-10 rounded-full bg-signal" aria-hidden />
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="max-w-prose text-sm leading-6 text-text-2">{body}</p>
      {action}
    </div>
  );
}

export function EvidenceGap({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span aria-hidden className={`mono w-4 text-center ${ok ? "text-success" : "text-warning"}`}>
        {ok ? "✓" : "✕"}
      </span>
      <span className={ok ? "text-text-2" : ""}>{label}</span>
      <span className="sr-only">{ok ? "present" : "missing"}</span>
    </li>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-balance text-[30px] font-semibold leading-[1.12] tracking-[-0.025em] text-ink sm:text-[36px]">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm leading-6 text-text-2">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-3">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`mono text-xs text-text-3 ${className}`}>{children}</span>;
}

export function fmtDate(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", { day: "2-digit", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) }).toUpperCase();
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  const cls = tone === "warning" ? "bg-warning-bg text-warning" : tone === "danger" ? "bg-danger-bg text-danger" : tone === "success" ? "bg-success-bg text-success" : "bg-blueprint-bg text-blueprint";
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={`rounded-[16px] border border-current/10 px-3.5 py-3 text-sm leading-5 ${cls}`}>
      {children}
    </div>
  );
}

export function WhyLink({ type, id }: { type: string; id: string }) {
  return (
    <Link href={`/app/why/${type}/${id}`} className="btn btn-sm" title="Explain why, from linked evidence">
      Why?
    </Link>
  );
}
