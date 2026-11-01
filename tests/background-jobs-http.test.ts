import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const runner = vi.hoisted(() => vi.fn());
const log = vi.hoisted(() => vi.fn());
vi.mock("@/server/background-jobs", () => ({ runBackgroundJobs: runner }));
vi.mock("@/server/audit", () => ({ log }));
import { POST } from "@/app/api/jobs/run/route";
const secret = "fixture-scheduler-credential-at-least-32-chars";
const request = (token?: string) => new Request("https://example.invalid/api/jobs/run", { method: "POST", headers: token ? { Authorization: "Bearer " + token } : {} });
beforeEach(() => { vi.stubEnv("CRON_SECRET", secret); runner.mockReset(); log.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
describe("trusted scheduler boundary", () => {
  it("rejects missing, short and wrong credentials before any queue access", async () => {
    for (const token of [undefined, "short", "wrong-scheduler-credential-at-least-32-chars"]) expect((await POST(request(token))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "short"); expect((await POST(request("short"))).status).toBe(401);
    expect(runner).not.toHaveBeenCalled();
  });
  it("reports completed work without caching and signals failed/exhausted jobs to the operator", async () => {
    runner.mockResolvedValue({ claimed: 1, done: 1, failed: 0, exhausted: 0 });
    const response = await POST(request(secret));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toContain("no-store");
    for (const count of [{ failed: 1, exhausted: 0 }, { failed: 0, exhausted: 1 }]) {
      runner.mockResolvedValue({ claimed: 1, done: 0, ...count }); expect((await POST(request(secret))).status).toBe(503);
    }
  });
  it("does not disclose database/payload errors in the response or operational log", async () => {
    runner.mockRejectedValue(new Error("private database credentials " + secret));
    const response = await POST(request(secret));
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: "job_runner_unavailable" });
    expect(log).toHaveBeenCalledExactlyOnceWith("error", "job_runner_unavailable");
  });
});
