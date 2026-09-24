import type { WorkboardKind } from "../workbench/types.ts";

export type CaptureKind = "photo" | "problem" | "test" | "decision" | "reflection";

export interface CaptureKindDefinition {
  kind: CaptureKind;
  label: string;
  icon: "photo" | "problem" | "test" | "decision" | "reflection";
  hint: string;
  description: string;
}

export interface CapturePrompt {
  eyebrow: string;
  title: string;
  helper: string;
}

export const CAPTURE_KINDS: readonly CaptureKindDefinition[] = [
  { kind: "photo", label: "Photo", icon: "photo", hint: "≤15 sec", description: "Preserve a physical build or revision." },
  { kind: "problem", label: "Problem", icon: "problem", hint: "≤30 sec", description: "Record something the team noticed." },
  { kind: "test", label: "Test", icon: "test", hint: "≤45 sec", description: "Capture a result before details disappear." },
  { kind: "decision", label: "Decision", icon: "decision", hint: "≤45 sec", description: "Keep what you chose and why." },
  { kind: "reflection", label: "Reflection", icon: "reflection", hint: "≤30 sec", description: "Student-authored learning and next step." },
] as const;

const PROMPTS: Record<CaptureKind, CapturePrompt> = {
  photo: {
    eyebrow: "Physical evidence",
    title: "What changed in this photo?",
    helper: "Take the photo first. Add only the context someone else would not know from looking at it.",
  },
  problem: {
    eyebrow: "Observed problem",
    title: "What did you notice?",
    helper: "Describe the symptom, not a polished explanation. You can link it to an iteration later.",
  },
  test: {
    eyebrow: "Test evidence",
    title: "What were you testing?",
    helper: "A title and result are enough to save now. Experimental detail can be added when it matters.",
  },
  decision: {
    eyebrow: "Engineering decision",
    title: "What did you decide — and why?",
    helper: "The reasoning stays student-authored. Link supporting evidence if it already exists.",
  },
  reflection: {
    eyebrow: "Student reflection",
    title: "What did you learn?",
    helper: "Capture your own words. TraceLab does not generate or rewrite reflection content.",
  },
};

export function capturePrompt(kind: CaptureKind): CapturePrompt {
  return PROMPTS[kind];
}

export function captureDestination(kind: CaptureKind): WorkboardKind {
  if (kind === "test") return "test-bench";
  if (kind === "decision") return "decision-trail";
  return "recent-evidence";
}

export type CaptureDraftValidation = { ok: true } | { ok: false; message: string };

export function validateCaptureDraft(kind: CaptureKind, fields: Readonly<Record<string, string>>, hasPhoto: boolean): CaptureDraftValidation {
  if (kind === "photo" && !hasPhoto) return { ok: false, message: "Choose or take a photo first." };
  if (kind === "decision" && !fields.rationale?.trim()) return { ok: false, message: "A decision needs your reason (why)." };
  return { ok: true };
}


export function captureSyncState(
  clientId: string,
  remaining: readonly { clientId: string }[],
): "synced" | "local" {
  return remaining.some((item) => item.clientId === clientId) ? "local" : "synced";
}

export function isCaptureKind(value: string | null | undefined): value is CaptureKind {
  return CAPTURE_KINDS.some((item) => item.kind === value);
}

export interface CaptureWorkspaceOptions {
  teamId: string;
  canAuthorStudentContent: boolean;
  subsystems: Array<{ id: string; name: string }>;
  iterations: Array<{ id: string; title: string }>;
  tests: Array<{ id: string; title: string }>;
}
