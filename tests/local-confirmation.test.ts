import { describe, expect, it } from "vitest";
import { localConfirmation, type LocalMailMessage } from "@/app/auth/local-confirmation";

const token = "a".repeat(43);
const origin = "http://localhost:3000";
const message: LocalMailMessage = { id: "synthetic", subject: "Confirm", purpose: "verify_email", actionUrl: `${origin}/auth?mode=verify&next=%2Fworkspace#token=${token}` };

describe("local confirmation link boundary", () => {
  it("accepts a same-origin link for the intended action", () => {
    expect(localConfirmation(message, "verify_email", origin)).toEqual({ token, url: message.actionUrl });
    const reset = { ...message, purpose: "reset_password" as const, actionUrl: `${origin}/auth?mode=reset#token=${token}` };
    expect(localConfirmation(reset, "reset_password", origin)?.token).toBe(token);
  });
  it("rejects foreign origins, unrelated paths, wrong actions and invalid secrets", () => {
    for (const actionUrl of [`https://foreign.example/auth?mode=verify#token=${token}`, `${origin}/workspace?mode=verify#token=${token}`, `${origin}/auth?mode=reset#token=${token}`, `${origin}/auth?mode=verify#token=short`, `${origin}/auth?mode=verify`, "javascript:alert(1)"]) {
      expect(localConfirmation({ ...message, actionUrl }, "verify_email", origin)).toBeNull();
    }
    expect(localConfirmation(message, "reset_password", origin)).toBeNull();
    expect(localConfirmation({ ...message, purpose: undefined }, "verify_email", origin)).toBeNull();
  });
});
