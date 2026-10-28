import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedCron } from "@/server/cron-auth";

const flush = vi.hoisted(() => vi.fn());
vi.mock("@/server/account-mail", () => ({ flushAccountMail: flush }));
import { POST } from "@/app/api/account/mail-dispatch/route";

const secret = "fixture-worker-secret-with-at-least-32-chars";
const request = (token = secret) => new Request("https://pilot.example.org/api/account/mail-dispatch", { method: "POST", headers: { Authorization: "Bearer " + token } });
beforeEach(() => {
  vi.stubEnv("CRON_SECRET", secret);
  vi.stubEnv("MAIL_TRANSPORT", "resend"); vi.stubEnv("MAIL_ENABLE_EXTERNAL_DELIVERY", "true");
  vi.stubEnv("RESEND_API_KEY", "fixture-provider-key"); vi.stubEnv("MAIL_FROM", "TraceLab <accounts@example.org>");
  vi.stubEnv("SECRETS_ENCRYPTION_KEY", "fixture-encryption-key-with-at-least-32-chars");
  flush.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("scheduled account mail dispatch", () => {
  it("rejects missing/short credentials and wrong bearer tokens before accessing the outbox", async () => {
    expect(authorizedCron(new Headers({ authorization: "Bearer " + secret }), "short")).toBe(false);
    expect(authorizedCron(new Headers(), secret)).toBe(false);
    expect(authorizedCron(new Headers({ authorization: "Bearer " + "x".repeat(600) }), secret)).toBe(false);
    expect((await POST(request("a-different-worker-secret-with-32-chars"))).status).toBe(401);
    expect(flush).not.toHaveBeenCalled();
  });
  it("reports unconfigured mail as unavailable rather than a successful delivery", async () => {
    vi.stubEnv("MAIL_TRANSPORT", "local");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ configured: false, processed: 0 });
    expect(flush).not.toHaveBeenCalled();
  });
  it("returns counts without identities and disables response caching", async () => {
    flush.mockResolvedValue({ processed: 2, sent: 2, failed: 0, exhausted: 0 });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, configured: true, processed: 2, sent: 2, failed: 0, exhausted: 0 });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("alerts the operator on failures and exhausted deliveries", async () => {
    for (const result of [{ processed: 1, sent: 0, failed: 1, exhausted: 0 }, { processed: 0, sent: 0, failed: 0, exhausted: 1 }]) {
      flush.mockResolvedValue(result);
      expect((await POST(request())).status).toBe(503);
    }
  });
  it("does not expose provider errors or secret values", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      flush.mockRejectedValue(new Error("provider response with " + secret));
      const response = await POST(request()), body = await response.text();
      expect(response.status).toBe(503);
      expect(body).not.toContain(secret);
      expect(consoleError.mock.calls.flat().join(" ")).not.toContain(secret);
    } finally { consoleError.mockRestore(); }
  });
});
