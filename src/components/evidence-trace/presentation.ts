import type { TraceIconName } from "@/components/tracelab/trace-icon";
import type { EvidenceTraceKind, EvidenceTraceNode, EvidenceTraceRelation } from "./types";

export const TRACE_KIND_ORDER: EvidenceTraceKind[] = ["source_event", "iteration", "test", "decision"];

export const TRACE_KIND_META: Record<EvidenceTraceKind, { label: string; icon: TraceIconName; tone: string }> = {
  source_event: { label: "Source event", icon: "evidence", tone: "source" },
  iteration: { label: "Iteration", icon: "timeline", tone: "revision" },
  test: { label: "Test", icon: "test", tone: "test" },
  decision: { label: "Decision", icon: "decision", tone: "decision" },
};

const RELATION_LABELS: Record<string, string> = {
  RESPONDS_TO: "responds to",
  IMPLEMENTS: "implements",
  MODIFIES: "modifies",
  TESTS: "tests",
  SUPPORTS: "supports",
  CONTRADICTS: "contradicts",
  SUPERSEDES: "supersedes",
  DERIVED_FROM: "derived from",
  CONTRIBUTED_BY: "contributed by",
  LEADS_TO: "leads to",
  REFERENCES: "references",
  RELATED_TO: "related to",
};

export function relationHumanLabel(relation: Pick<EvidenceTraceRelation, "type">): string {
  return RELATION_LABELS[relation.type] ?? relation.type.toLowerCase().replaceAll("_", " ");
}

export function relationStatusLabel(relation: Pick<EvidenceTraceRelation, "status">): "Accepted" | "Suggested" | "Rejected" | string {
  if (relation.status === "accepted") return "Accepted";
  if (relation.status === "suggested") return "Suggested";
  if (relation.status === "rejected") return "Rejected";
  return relation.status;
}

export function nodeTechnicalLine(node: EvidenceTraceNode): string {
  if (node.kind === "source_event") return [node.provider, node.detail].filter(Boolean).join(" · ") || "Source preserved";
  if (node.kind === "test") return [node.outcome, node.detail].filter(Boolean).join(" · ") || "Test evidence";
  if (node.kind === "decision") return [node.outcome, node.detail].filter(Boolean).join(" · ") || "Decision record";
  return node.detail || "Iteration record";
}

export function compactTraceDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}
