import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canInviteRole, developmentBillingEnabled, devSimulatorEnabled, entityTypeSchema, safeInternalPath } from "../src/lib/security";

const source = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

describe("safe internal redirects", () => {
  it("accepts normalized internal paths", () => {
    expect(safeInternalPath("/app/inbox?from=auth#new")).toBe("/app/inbox?from=auth#new");
  });

  it.each(["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", "/app\nSet-Cookie:x"])('rejects %s', (value) => {
    expect(safeInternalPath(value)).toBe("/app");
  });
});

describe("security enums and fail-closed development switches", () => {
  it("rejects arbitrary relation entity types", () => {
    expect(entityTypeSchema.safeParse("source_event").success).toBe(true);
    expect(entityTypeSchema.safeParse("made_up_table").success).toBe(false);
  });

  it("requires both non-production and an explicit simulator flag", () => {
    expect(devSimulatorEnabled({ NODE_ENV: "production", ENABLE_DEV_SIMULATOR: "true" })).toBe(false);
    expect(devSimulatorEnabled({ NODE_ENV: "development", ENABLE_DEV_SIMULATOR: undefined })).toBe(false);
    expect(devSimulatorEnabled({ NODE_ENV: "development", ENABLE_DEV_SIMULATOR: "true" })).toBe(true);
  });

  it("keeps the fake billing adapter out of production", () => {
    expect(developmentBillingEnabled({ NODE_ENV: "production", BILLING_ADAPTER: "development" })).toBe(false);
    expect(developmentBillingEnabled({ NODE_ENV: "development", BILLING_ADAPTER: undefined })).toBe(false);
    expect(developmentBillingEnabled({ NODE_ENV: "development", BILLING_ADAPTER: "development" })).toBe(true);
  });

  it("does not let a student lead create coach privilege", () => {
    expect(canInviteRole("student_lead", "student")).toBe(true);
    expect(canInviteRole("student_lead", "coach")).toBe(false);
    expect(canInviteRole("coach", "coach")).toBe(true);
  });
});

describe("P0 server boundaries", () => {
  it("does not expose raw capture persistence as a Server Action", () => {
    const actions = source("src/server/actions.ts");
    expect(actions).not.toMatch(/export\s+async\s+function\s+persistCapture/);
    expect(source("src/server/capture.ts")).toContain('import "server-only"');
  });

  it("does not cache authenticated application pages", () => {
    const worker = source("public/sw.js");
    expect(worker).not.toContain('const SHELL = ["/app');
    expect(worker).toContain('url.pathname.startsWith("/app")');
  });

  it("keeps global policy publishing platform-admin only", () => {
    expect(source("src/server/actions.ts")).toContain('ctx.user.platformRole !== "platform_admin"');
  });

  it("stores only hashed session tokens and has no insecure production cookie override", () => {
    const auth = source("src/server/auth.ts");
    expect(auth).toContain("hashSessionToken(token)");
    expect(auth).not.toContain("ALLOW_INSECURE_COOKIES");
    expect(auth).not.toContain("scryptSync");
  });

  it("keeps public previews available when the optional development database is offline", () => {
    const auth = source("src/server/auth.ts");
    expect(auth).toContain('msg: "local_session_unavailable"');
    expect(auth).not.toContain('process.env.DEV_AUTH_BYPASS');
    expect(auth).toContain('if (!await isEmailVerified(row.user.id)) return null');
    expect(auth).toContain("return null");
  });

  it("rejects unverified legacy team cleanup instead of removing live evidence or reporting success", () => {
    const jobs = source("src/app/api/jobs/run/route.ts");
    const cleanup = jobs.split('if (kind === "storage.cleanup") {')[1]?.split('if (kind === "notify.tests_without_decisions")')[0];
    expect(cleanup).toContain('throw new Error("Legacy team storage cleanup is disabled');
    expect(cleanup).not.toContain("deletePrefix");
    expect(cleanup).not.toContain("return;");
    const deletion = source("src/server/actions.ts").split("export async function deleteTeam()")[1];
    expect(deletion).toContain("await requireUser()");
    expect(deletion).toContain("throw new Error(messages[");
    expect(deletion).not.toContain("enqueueJob");
    expect(deletion).not.toContain("db.delete(teams)");
  });
});
