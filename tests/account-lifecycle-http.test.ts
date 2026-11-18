import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountError, accountHash } from "@/server/account-contract";

const state = vi.hoisted(() => ({ user: { id: "own-user" } as { id: string } | null, cookies: new Map<string, string>() }));
const service = vi.hoisted(() => ({ get: vi.fn(), manage: vi.fn(), purge: vi.fn(), storage: {} }));
vi.mock("@/server/auth", () => ({ getCurrentUser: async () => state.user }));
vi.mock("@/server/account-http", () => ({ accountResponse: (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => state.cookies.has(key) ? { value: state.cookies.get(key) } : undefined }) }));
vi.mock("@/server/account-lifecycle-service", () => ({ getAccountLifecycle: service.get, manageAccountLifecycle: service.manage, runLifecyclePurge: service.purge }));
vi.mock("@/server/workspace-media-storage", () => ({ mediaStorage: service.storage }));
import { GET, POST } from "@/app/api/account/lifecycle/route";
import { POST as RUN } from "@/app/api/account/lifecycle-run/route";

const origin = "https://pilot.example.org", secret = "fixture-lifecycle-worker-at-least-32-chars";
const mutation = (body: unknown, headers: Record<string, string> = {}) => new Request(origin + "/api/account/lifecycle", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const run = (token = secret) => new Request(origin + "/api/account/lifecycle-run", { method: "POST", headers: { Authorization: "Bearer " + token } });
beforeEach(() => {
  vi.stubEnv("APP_URL", origin); vi.stubEnv("CRON_SECRET", secret);
  state.user = { id: "own-user" }; state.cookies.clear(); state.cookies.set("pt_session", "fixture-session-bearer");
  service.get.mockReset(); service.manage.mockReset(); service.purge.mockReset();
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("account lifecycle HTTP boundary", () => {
  it("uses the authenticated identity rather than caller IDs and keeps status private", async () => {
    service.get.mockResolvedValue({ graceDays: 7, teams: [] });
    const response = await GET(new Request(origin + "/api/account/lifecycle?userId=foreign"));
    expect(service.get).toHaveBeenCalledWith({ userId: "own-user", sessionHash: accountHash("fixture-session-bearer") });
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain("fixture-session-bearer");
  });
  it("rejects unsigned and cross-site status access before reading rows", async () => {
    state.user = null; expect((await GET(new Request(origin + "/api/account/lifecycle"))).status).toBe(401);
    state.user = { id: "own-user" }; expect((await GET(new Request(origin + "/api/account/lifecycle", { headers: { "Sec-Fetch-Site": "cross-site" } }))).status).toBe(403);
    expect(service.get).not.toHaveBeenCalled();
  });
  it("rejects foreign/missing origins, unsigned mutations and oversized bodies before commands", async () => {
    expect((await POST(mutation({}, { Origin: "https://foreign.example.org" }))).status).toBe(403);
    const missing = mutation({}); missing.headers.delete("origin"); expect((await POST(missing)).status).toBe(403);
    state.user = null; expect((await POST(mutation({ action: "preview_team" }))).status).toBe(401);
    state.user = { id: "own-user" }; expect((await POST(mutation({ password: "x".repeat(5000) }))).status).toBe(413);
    expect(service.manage).not.toHaveBeenCalled();
  });
  it("passes exact confirmation/password to the authenticated service and reports actionable limits", async () => {
    const input = { action: "request_team", teamId: "fixture-team", confirmation: "Exact team name", password: "fixture-password" };
    service.manage.mockResolvedValue({ ok: true, graceDays: 7 });
    expect((await POST(mutation(input))).status).toBe(200);
    expect(service.manage).toHaveBeenCalledWith({ userId: "own-user", sessionHash: accountHash("fixture-session-bearer") }, input);
    service.manage.mockRejectedValue(new AccountError("rate_limited", 429)); const limited = await POST(mutation(input));
    expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBe("900");
  });
  it("does not reveal database/password details on internal failures", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    service.manage.mockRejectedValue(new Error("private database password fixture")); const response = await POST(mutation({}));
    expect(response.status).toBe(503); expect(await response.text()).not.toContain("private database");
    expect(log.mock.calls.flat().join(" ")).not.toContain("private database");
  });
});

describe("trusted lifecycle scheduler", () => {
  it("rejects incorrect or unconfigured credentials before calling the purge service", async () => {
    expect((await RUN(run("incorrect-worker-secret-at-least-32"))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", ""); expect((await RUN(run())).status).toBe(401); expect(service.purge).not.toHaveBeenCalled();
  });
  it("returns only bounded progress counts, using the configured private storage", async () => {
    service.purge.mockResolvedValue({ processed: 1, purged: 0, failed: 0, remaining: 3, blocked: 0 });
    const response = await RUN(run()); expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    expect(service.purge).toHaveBeenCalledWith(service.storage);
    expect(await response.json()).toEqual({ ok: true, processed: 1, purged: 0, failed: 0, remaining: 3, blocked: 0 });
  });
  it("signals cleanup failures, blocked jobs and internal outages without leaking keys", async () => {
    for (const result of [{ processed: 1, purged: 0, failed: 1, remaining: 1, blocked: 0 }, { processed: 0, purged: 0, failed: 0, remaining: 0, blocked: 1 }]) {
      service.purge.mockResolvedValue(result); expect((await RUN(run())).status).toBe(503);
    }
    const log = vi.spyOn(console, "error").mockImplementation(() => {}); service.purge.mockRejectedValue(new Error("secret object key " + secret));
    const response = await RUN(run()); expect(response.status).toBe(503); expect(await response.text()).not.toContain(secret); expect(log.mock.calls.flat().join(" ")).not.toContain(secret);
  });
});
