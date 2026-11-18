import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountHash } from "@/server/account-contract";

const state = vi.hoisted(() => ({ cookies: new Map<string, string>() }));
const list = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => state.cookies.has(key) ? { value: state.cookies.get(key) } : undefined }) }));
vi.mock("next/server", () => ({ after: vi.fn(), NextResponse: { json: (body: unknown, init: ResponseInit) => Response.json(body, init) } }));
vi.mock("@/server/auth", () => ({ createSession: vi.fn(), destroySession: vi.fn(), getCurrentUser: vi.fn() }));
vi.mock("@/server/account-service", () => ({ authenticateAccount: vi.fn(), registerAccount: vi.fn(), requestAccountEmail: vi.fn(), resetAccountPassword: vi.fn(), verifyAccountEmail: vi.fn() }));
vi.mock("@/server/account-mail", () => ({ flushAccountMail: vi.fn(), listLocalAccountMail: list }));
import { GET, POST } from "@/app/api/account/mail-preview/route";

const url = "http://localhost:3000/api/account/mail-preview";
const mailbox = "m".repeat(43);
const body = { email: "fixture@example.test", purpose: "verify_email" };
function request(payload: unknown = body, headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload) });
}
beforeEach(() => {
  vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("MAIL_TRANSPORT", "local"); vi.stubEnv("MAIL_PREVIEW_ENABLED", "true");
  state.cookies.clear(); state.cookies.set("pt_mailbox", mailbox); list.mockReset(); list.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllEnvs());

describe("browser-scoped local confirmation preview", () => {
  it("normalizes the submitted email and derives mailbox scope only from the browser cookie", async () => {
    const response = await POST(request({ email: " Fixture@Example.test ", purpose: "verify_email" }));
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(accountHash(mailbox), body);
    expect(await response.json()).toEqual({ messages: [], localOnly: true });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("separates password-reset requests from email confirmation", async () => {
    await POST(request({ ...body, purpose: "reset_password" }));
    expect(list).toHaveBeenCalledWith(accountHash(mailbox), { ...body, purpose: "reset_password" });
  });
  it("returns no messages without a valid browser mailbox, even with another mailbox in the URL", async () => {
    for (const cookie of [undefined, "invalid"]) {
      state.cookies.clear(); if (cookie) state.cookies.set("pt_mailbox", cookie);
      const response = await POST(new Request(url + "?previewKey=" + mailbox, { method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      expect(await response.json()).toEqual({ messages: [], localOnly: true });
    }
    expect(list).not.toHaveBeenCalled();
  });
  it("rejects missing or foreign Origin before accessing any mailbox", async () => {
    for (const origin of ["", "https://foreign.example"]) {
      expect((await POST(request(body, { Origin: origin }))).status).toBe(403);
    }
    expect(list).not.toHaveBeenCalled();
  });
  it("does not expose previews in production or through a remote proxy", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect((await POST(request())).status).toBe(404);
    expect((await GET(new Request(url))).status).toBe(404);
    vi.stubEnv("NODE_ENV", "development");
    expect((await POST(request(body, { "X-Forwarded-For": "203.0.113.12, 127.0.0.1" }))).status).toBe(404);
    expect((await POST(request(body, { "Sec-Fetch-Site": "cross-site" }))).status).toBe(404);
    vi.stubEnv("MAIL_PREVIEW_ENABLED", "false");
    expect((await POST(request())).status).toBe(404);
    expect(list).not.toHaveBeenCalled();
  });
  it("rejects invalid purpose, email and caller-supplied mailbox identity", async () => {
    for (const payload of [{ ...body, purpose: "signin" }, { ...body, email: "bad" }, { ...body, previewKey: mailbox }]) {
      expect((await POST(request(payload))).status).toBe(400);
    }
    expect(list).not.toHaveBeenCalled();
  });
  it("bounds JSON body size and rejects other content types", async () => {
    expect((await POST(request({ ...body, email: "x".repeat(5000) }))).status).toBe(413);
    expect((await POST(request(body, { "Content-Type": "text/plain" }))).status).toBe(415);
    expect(list).not.toHaveBeenCalled();
  });
  it("preserves GET compatibility without trusting query-string identities", async () => {
    const response = await GET(new Request(url + "?email=other%40example.test&previewKey=foreign"));
    expect(response.status).toBe(200);
    expect(list).toHaveBeenCalledWith(accountHash(mailbox), undefined);
    expect(await response.json()).toEqual({ messages: [], localOnly: true });
  });
  it("never returns database details when preview lookup fails", async () => {
    list.mockRejectedValue(new Error("private database detail"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, code: "service_unavailable" });
  });
});
