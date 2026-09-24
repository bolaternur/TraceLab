import { describe, expect, it } from "vitest";
import { evaluatePolicy, POLICY_ACTIONS, SEED_PROFILES, type ActionMatrix } from "../src/modules/policies/engine";

const profile = (key: string) => SEED_PROFILES.find((p) => p.key === key)!;
const ctx = (key: string, overrides: Partial<Parameters<typeof evaluatePolicy>[0]> = {}) => {
  const p = profile(key);
  const v = p.versions[0];
  return { matrix: v.actionMatrix as ActionMatrix, policyStatus: v.status, strictProfile: p.strict, studentOwnedMode: true, actorRole: "student" as const, ...overrides };
};

describe("policy engine — VEX strict (Student-Owned Mode)", () => {
  it("blocks generative notebook manipulation", () => {
    for (const a of ["rewrite_student_text", "grammar_improve_student_text", "organize_notebook_content", "generate_notebook_outline", "generate_portfolio_text", "generate_reflection"] as const) {
      expect(evaluatePolicy({ ...ctx("vex_strict"), action: a }).decision).toBe("BLOCK");
    }
  });
  it("allows deterministic evidence actions", () => {
    expect(evaluatePolicy({ ...ctx("vex_strict"), action: "search_evidence" }).decision).toBe("ALLOW");
    expect(evaluatePolicy({ ...ctx("vex_strict"), action: "retrieve_evidence" }).decision).toBe("ALLOW");
    expect(evaluatePolicy({ ...ctx("vex_strict"), action: "export_deterministic_notebook" }).decision).toBe("ALLOW");
    expect(evaluatePolicy({ ...ctx("vex_strict"), action: "suggest_structural_gap" }).decision).toBe("ALLOW");
  });
  it("still blocks when Student-Owned Mode is off (matrix is BLOCK)", () => {
    expect(evaluatePolicy({ ...ctx("vex_strict", { studentOwnedMode: false }), action: "rewrite_student_text" }).decision).toBe("BLOCK");
  });
});

describe("policy engine — FTC 2026-27 pending review", () => {
  it("requires review for risky actions (fail-safe)", () => {
    expect(evaluatePolicy({ ...ctx("ftc_2026_27"), action: "generate_portfolio_text" }).decision).toBe("REQUIRE_REVIEW");
    expect(evaluatePolicy({ ...ctx("ftc_2026_27"), action: "export_generated_content" }).decision).toBe("REQUIRE_REVIEW");
  });
  it("never blocks the evidence core", () => {
    expect(evaluatePolicy({ ...ctx("ftc_2026_27"), action: "search_evidence" }).allowed).toBe(true);
  });
  it("generate_reflection is always blocked", () => {
    expect(evaluatePolicy({ ...ctx("ftc_2026_27"), action: "generate_reflection" }).decision).toBe("BLOCK");
  });
});

describe("policy engine — FTC 2025-26 archived", () => {
  it("allowed AI composition with disclosure", () => {
    expect(evaluatePolicy({ ...ctx("ftc_2025_26", { policyStatus: "active" }), action: "generate_portfolio_text" }).decision).toBe("ALLOW_WITH_DISCLOSURE");
  });
  it("superseded versions are treated as needing review", () => {
    expect(evaluatePolicy({ ...ctx("ftc_2025_26", { policyStatus: "needs_review" }), action: "generate_portfolio_text" }).decision).toBe("REQUIRE_REVIEW");
  });
});

describe("policy engine — ISEF and generic", () => {
  it("ISEF draft blocks protected outputs", () => {
    expect(evaluatePolicy({ ...ctx("isef_2027"), action: "generate_portfolio_text" }).decision).toBe("BLOCK");
  });
  it("generic allows with disclosure but never generates reflection", () => {
    expect(evaluatePolicy({ ...ctx("generic"), action: "rewrite_student_text" }).decision).toBe("ALLOW_WITH_DISCLOSURE");
    expect(evaluatePolicy({ ...ctx("generic"), action: "generate_reflection" }).decision).toBe("BLOCK");
  });
  it("Student-Owned Mode downgrades ALLOW to ALLOW_WITH_DISCLOSURE for generative actions", () => {
    const m: ActionMatrix = { rewrite_student_text: "ALLOW" };
    expect(evaluatePolicy({ action: "rewrite_student_text", matrix: m, policyStatus: "active", strictProfile: false, studentOwnedMode: true, actorRole: "student" }).decision).toBe("ALLOW_WITH_DISCLOSURE");
    expect(evaluatePolicy({ action: "rewrite_student_text", matrix: m, policyStatus: "active", strictProfile: false, studentOwnedMode: false, actorRole: "student" }).decision).toBe("ALLOW");
  });
});

describe("policy engine — invariants", () => {
  it("coach_edit_student_content is blocked everywhere", () => {
    for (const p of SEED_PROFILES) expect(evaluatePolicy({ ...ctx(p.key), action: "coach_edit_student_content" }).decision).toBe("BLOCK");
  });
  it("no policy → REQUIRE_REVIEW for generative actions", () => {
    expect(evaluatePolicy({ action: "rewrite_student_text", matrix: null, policyStatus: "none", strictProfile: false, studentOwnedMode: false, actorRole: "student" }).decision).toBe("REQUIRE_REVIEW");
  });
  it("unknown matrix entries never resolve to ALLOW", () => {
    for (const a of POLICY_ACTIONS) {
      const r = evaluatePolicy({ action: a, matrix: {}, policyStatus: "active", strictProfile: false, studentOwnedMode: false, actorRole: "student" });
      if (!["search_evidence", "retrieve_evidence", "suggest_structural_gap", "transcribe_voice_exact", "export_deterministic_notebook"].includes(a)) expect(r.decision).not.toBe("ALLOW");
    }
  });
  it("every seeded version covers every action", () => {
    for (const p of SEED_PROFILES) for (const v of p.versions) for (const a of POLICY_ACTIONS) expect(v.actionMatrix[a]).toBeDefined();
  });
});
