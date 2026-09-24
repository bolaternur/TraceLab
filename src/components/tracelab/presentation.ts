export type EvidenceTone = "source" | "revision" | "test" | "decision" | "verified" | "failure" | "pending" | "neutral";

export interface SourcePresentation {
  label: string;
  eventLabel: string;
  mark: "branch" | "cad" | "capture" | "message" | "data" | "upload" | "source";
  tone: EvidenceTone;
}

const SOURCE_PRESENTATION: Record<string, Omit<SourcePresentation, "eventLabel">> = {
  github: { label: "GitHub", mark: "branch", tone: "source" },
  onshape: { label: "Onshape", mark: "cad", tone: "source" },
  capture: { label: "Capture", mark: "capture", tone: "neutral" },
  telegram: { label: "Telegram", mark: "message", tone: "neutral" },
  discord: { label: "Discord", mark: "message", tone: "neutral" },
  csv: { label: "CSV", mark: "data", tone: "neutral" },
  upload: { label: "Upload", mark: "upload", tone: "neutral" },
};

export function getSourcePresentation(provider: string, eventType?: string | null): SourcePresentation {
  const normalizedProvider = provider.toLowerCase();
  const base = SOURCE_PRESENTATION[normalizedProvider] ?? {
    label: provider || "Source",
    mark: "source" as const,
    tone: "neutral" as const,
  };
  return {
    ...base,
    eventLabel: (eventType || "event").replaceAll("_", " "),
  };
}

export function getEvidenceTone(kind: string, outcome?: string | null): EvidenceTone {
  const normalizedOutcome = outcome?.toLowerCase() ?? "";
  if (["fail", "failed", "reject", "rejected", "revert", "reverted"].includes(normalizedOutcome)) return "failure";
  if (["pass", "passed", "verified", "supported"].includes(normalizedOutcome)) return "verified";
  if (kind === "decision") return "decision";
  if (kind === "test") return "test";
  if (kind === "iteration" || kind === "revision") return "revision";
  if (kind === "source_event" || kind === "source") return "source";
  if (kind === "problem" || kind === "hypothesis") return "pending";
  return "neutral";
}

export interface MobileNavCandidate {
  href: string;
  label: string;
  glyph: string;
  exact?: boolean;
  badge?: number;
}

export function getPrimaryMobileItems<T extends MobileNavCandidate>(items: readonly T[]): T[] {
  const order = ["/app", "/app/timeline", "/app/memory"];
  return order.flatMap((href) => {
    const match = items.find((item) => item.href === href);
    return match ? [match] : [];
  });
}

export function formatTechnicalDate(date: Date | string, timeZone = "UTC"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")} ${get("month").slice(0, 3).toUpperCase()} · ${get("hour")}:${get("minute")}`;
}
