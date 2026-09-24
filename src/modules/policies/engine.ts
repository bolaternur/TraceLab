/**
 * Competition Policy Engine.
 *
 * Rules are versioned DATA (policy_versions.action_matrix), never scattered `if (program === ...)` in UI.
 * Every sensitive action is evaluated server-side through `evaluatePolicy`.
 */

export const POLICY_ACTIONS = [
  "rewrite_student_text",
  "grammar_improve_student_text",
  "summarize_for_export",
  "generate_portfolio_text",
  "organize_notebook_content",
  "generate_notebook_outline",
  "generate_code",
  "transcribe_voice_exact",
  "transcribe_and_cleanup_voice",
  "generate_reflection",
  "suggest_structural_gap",
  "search_evidence",
  "retrieve_evidence",
  "generate_ai_memory_answer",
  "export_generated_content",
  "export_deterministic_notebook",
  "coach_edit_student_content",
] as const;

export type PolicyAction = (typeof POLICY_ACTIONS)[number];

export const POLICY_DECISIONS = ["ALLOW", "ALLOW_WITH_DISCLOSURE", "BLOCK", "REQUIRE_REVIEW", "UNKNOWN"] as const;
export type PolicyDecision = (typeof POLICY_DECISIONS)[number];

export type ActionMatrix = Partial<Record<PolicyAction, PolicyDecision>>;

/** Actions that touch student-authored competition content generatively. */
export const GENERATIVE_ACTIONS: PolicyAction[] = [
  "rewrite_student_text",
  "grammar_improve_student_text",
  "summarize_for_export",
  "generate_portfolio_text",
  "organize_notebook_content",
  "generate_notebook_outline",
  "generate_reflection",
  "transcribe_and_cleanup_voice",
  "export_generated_content",
];

/** Deterministic actions the Evidence Core relies on; always safe. */
export const CORE_SAFE_ACTIONS: PolicyAction[] = [
  "search_evidence",
  "retrieve_evidence",
  "suggest_structural_gap",
  "transcribe_voice_exact",
  "export_deterministic_notebook",
];

export function isPolicyAction(v: unknown): v is PolicyAction {
  return typeof v === "string" && (POLICY_ACTIONS as readonly string[]).includes(v);
}

export function isPolicyDecision(v: unknown): v is PolicyDecision {
  return typeof v === "string" && (POLICY_DECISIONS as readonly string[]).includes(v);
}

export interface PolicyContext {
  action: PolicyAction;
  matrix: ActionMatrix | null; // null when no active policy version exists
  policyStatus: "active" | "needs_review" | "draft" | "superseded" | "none";
  studentOwnedMode: boolean;
  strictProfile: boolean;
  actorRole: "student" | "student_lead" | "coach" | "org_admin" | "platform_admin";
}

export interface PolicyResult {
  decision: PolicyDecision;
  reason: string;
  allowed: boolean;
  disclosureRequired: boolean;
}

/**
 * Pure, deterministic evaluator. Fail-safe: anything unknown resolves to REQUIRE_REVIEW/BLOCK rather than ALLOW.
 */
export function evaluatePolicy(ctx: PolicyContext): PolicyResult {
  const { action } = ctx;

  // Coaches never author/edit student content regardless of profile.
  if (action === "coach_edit_student_content") {
    return finalize("BLOCK", "Coaches and administrators cannot edit student-authored engineering content.");
  }

  // Core deterministic actions are always allowed; they never generate content.
  if (CORE_SAFE_ACTIONS.includes(action)) {
    return finalize("ALLOW", "Deterministic evidence action; no generative transformation.");
  }

  // Student-Owned Mode on a strict profile blocks every generative action outright.
  if (ctx.studentOwnedMode && ctx.strictProfile && GENERATIVE_ACTIONS.includes(action)) {
    return finalize("BLOCK", "Student-Owned Mode blocks generative transformations under a strict competition policy.");
  }

  if (ctx.policyStatus === "none" || !ctx.matrix) {
    return finalize("REQUIRE_REVIEW", "No competition policy is active for this team. Generative actions require review.");
  }

  if (ctx.policyStatus === "needs_review" || ctx.policyStatus === "draft") {
    const explicit = ctx.matrix[action];
    if (explicit === "BLOCK") return finalize("BLOCK", "Blocked by the pending policy version.");
    return finalize(
      "REQUIRE_REVIEW",
      "Current season rules require review before AI-assisted competition actions are enabled.",
    );
  }

  const decision = ctx.matrix[action];
  if (!decision || decision === "UNKNOWN") {
    return finalize("REQUIRE_REVIEW", "This action is not covered by the active policy version; treat as requiring review.");
  }

  // Student-Owned Mode on a non-strict profile downgrades ALLOW → ALLOW_WITH_DISCLOSURE for generative actions.
  if (ctx.studentOwnedMode && decision === "ALLOW" && GENERATIVE_ACTIONS.includes(action)) {
    return finalize("ALLOW_WITH_DISCLOSURE", "Student-Owned Mode requires disclosure for generative assistance.");
  }

  const reasons: Record<PolicyDecision, string> = {
    ALLOW: "Allowed by the active policy version.",
    ALLOW_WITH_DISCLOSURE: "Allowed when the AI contribution is disclosed and credited.",
    BLOCK: "Blocked by the active competition policy.",
    REQUIRE_REVIEW: "Requires an authorized policy review before use.",
    UNKNOWN: "Unknown.",
  };
  return finalize(decision, reasons[decision]);
}

function finalize(decision: PolicyDecision, reason: string): PolicyResult {
  return {
    decision,
    reason,
    allowed: decision === "ALLOW" || decision === "ALLOW_WITH_DISCLOSURE",
    disclosureRequired: decision === "ALLOW_WITH_DISCLOSURE",
  };
}

// ---------------------------------------------------------------------------
// Seeded policy baseline (research snapshot 2026-09-03). Stored as data in policy_versions.
// ---------------------------------------------------------------------------

function fill(base: PolicyDecision, overrides: ActionMatrix): ActionMatrix {
  const m: ActionMatrix = {};
  for (const a of POLICY_ACTIONS) m[a] = base;
  for (const a of CORE_SAFE_ACTIONS) m[a] = "ALLOW";
  m.coach_edit_student_content = "BLOCK";
  return { ...m, ...overrides };
}

export interface SeedProfile {
  key: string;
  program: string;
  name: string;
  description: string;
  strict: boolean;
  versions: Array<{
    version: string;
    status: "active" | "superseded" | "needs_review" | "draft";
    effectiveFrom: string | null;
    reviewedAt: string | null;
    reviewer: string;
    sourceUrls: string[];
    changelog: string;
    constraints: Record<string, unknown>;
    actionMatrix: ActionMatrix;
  }>;
}

export const SEED_PROFILES: SeedProfile[] = [
  {
    key: "vex_strict",
    program: "VEX",
    name: "VEX / RECF Student-Centered (strict)",
    description:
      "RECF Student-Centered Policy treats AI/LLM use to generate, organize, enhance or alter engineering notebook content as non-student-centered. Generative notebook manipulation is blocked. Not an official certification.",
    strict: true,
    versions: [
      {
        version: "2026.1",
        status: "active",
        effectiveFrom: "2026-05-01",
        reviewedAt: "2026-09-03",
        reviewer: "TraceLab policy baseline (research snapshot)",
        sourceUrls: ["https://www.roboticseducation.org/documents/"],
        changelog: "Initial strict baseline from RECF Student-Centered Policy as of 2026-09-03.",
        constraints: { notebookFormat: "chronological", generativeRewrite: false },
        actionMatrix: fill("BLOCK", {
          generate_code: "REQUIRE_REVIEW",
          generate_ai_memory_answer: "ALLOW_WITH_DISCLOSURE",
          export_deterministic_notebook: "ALLOW",
        }),
      },
    ],
  },
  {
    key: "ftc_2025_26",
    program: "FTC",
    name: "FTC 2025–26 DECODE (archived)",
    description:
      "Historical policy version for the 2025–26 season. Portfolio: cover + up to 15 content pages, file-size limits, minimize PII, judges do not follow external links; AI composition was allowed when appropriately credited.",
    strict: false,
    versions: [
      {
        version: "2025.26",
        status: "superseded",
        effectiveFrom: "2025-09-06",
        reviewedAt: "2026-09-03",
        reviewer: "TraceLab policy baseline (research snapshot)",
        sourceUrls: ["https://www.firstinspires.org/resource-library/ftc/game-and-season-info"],
        changelog: "Archived 2025–26 DECODE portfolio baseline. Superseded by 2026–27 pending review.",
        constraints: { maxContentPages: 15, coverPage: true, maxFileMb: 10, externalLinksFollowed: false, minimizePII: true },
        actionMatrix: fill("ALLOW_WITH_DISCLOSURE", {
          generate_code: "ALLOW_WITH_DISCLOSURE",
          generate_ai_memory_answer: "ALLOW_WITH_DISCLOSURE",
          generate_reflection: "BLOCK",
          rewrite_student_text: "ALLOW_WITH_DISCLOSURE",
        }),
      },
    ],
  },
  {
    key: "ftc_2026_27",
    program: "FTC",
    name: "FTC 2026–27 BIOBUZZ (policy pending review)",
    description:
      "The 2026–27 challenge launches 12 September 2026. Portfolio and AI rules have NOT been entered from the official manual. Risky actions remain UNKNOWN / REQUIRE_REVIEW until an authorized policy update.",
    strict: false,
    versions: [
      {
        version: "2026.27-pending",
        status: "needs_review",
        effectiveFrom: null,
        reviewedAt: null,
        reviewer: "",
        sourceUrls: ["https://www.firstinspires.org/resource-library/ftc/game-and-season-info"],
        changelog: "Placeholder created 2026-09-03. Awaiting official 2026–27 Game Manual / portfolio guidance.",
        constraints: {},
        actionMatrix: fill("UNKNOWN", { generate_reflection: "BLOCK" }),
      },
    ],
  },
  {
    key: "isef_2027",
    program: "ISEF",
    name: "Regeneron ISEF 2027 (future-ready)",
    description:
      "AI may be used as a cited resource, but generative AI must not write protected outputs (research plan, abstract, poster, citations). ISEF approval/safety workflows are NOT automatically satisfied by this app.",
    strict: true,
    versions: [
      {
        version: "2027.draft",
        status: "draft",
        effectiveFrom: null,
        reviewedAt: "2026-09-03",
        reviewer: "TraceLab policy baseline (research snapshot)",
        sourceUrls: ["https://www.societyforscience.org/isef/international-rules/"],
        changelog: "Draft baseline. Protected outputs blocked; retrieval allowed with citation.",
        constraints: { protectedOutputs: ["research_plan", "abstract", "poster", "citations"], approvalWorkflowExternal: true },
        actionMatrix: fill("BLOCK", {
          generate_code: "REQUIRE_REVIEW",
          generate_ai_memory_answer: "ALLOW_WITH_DISCLOSURE",
          grammar_improve_student_text: "REQUIRE_REVIEW",
        }),
      },
    ],
  },
  {
    key: "generic",
    program: "OTHER",
    name: "Generic engineering (no competition)",
    description: "No competition restrictions. Generative assistance is allowed with disclosure; student reflection is never generated.",
    strict: false,
    versions: [
      {
        version: "1.0",
        status: "active",
        effectiveFrom: "2026-01-01",
        reviewedAt: "2026-09-03",
        reviewer: "TraceLab",
        sourceUrls: [],
        changelog: "Default open profile.",
        constraints: {},
        actionMatrix: fill("ALLOW_WITH_DISCLOSURE", { generate_reflection: "BLOCK", generate_code: "ALLOW_WITH_DISCLOSURE" }),
      },
    ],
  },
];
