import { describe, expect, it, vi } from "vitest";
import { accountHash, accountOrigin, accountRateIdentity, accountResetInput, accountSignupInput, localMailPreviewAllowed, newAccountToken, readAccountJson } from "@/server/account-contract";
import { createResendMailTransport, resendConfigured } from "@/server/account-mail-resend";
import { accountCopy } from "@/app/auth/account-copy";

const local = { NODE_ENV: "development", APP_URL: "http://localhost:3000", MAIL_TRANSPORT: "local", MAIL_PREVIEW_ENABLED: "true" } as NodeJS.ProcessEnv;
const input = { email: "  Example@Example.test ", displayName: " Test ", password: "a sufficiently long password", locale: "kk" };

describe("account boundary contracts", () => {
  it("normalizes identity, bounds credentials and retains only internal destinations", () => {
    expect(accountSignupInput.parse(input)).toMatchObject({ email: "example@example.test", displayName: "Test", locale: "kk", next: "/workspace/" });
    for (const next of ["//evil.test/path", "https://evil.test", "/\\evil.test", "/\n/evil.test"]) expect(accountSignupInput.parse({ ...input, next }).next).toBe("/workspace/");
    expect(accountSignupInput.parse({ ...input, next: "/join/sample?source=invite" }).next).toBe("/join/sample?source=invite");
    expect(accountSignupInput.safeParse({ ...input, password: "short" }).success).toBe(false);
    expect(accountSignupInput.safeParse({ ...input, password: "a".repeat(129) }).success).toBe(false);
    expect(accountSignupInput.safeParse({ ...input, locale: "fr" }).success).toBe(false);
  });

  it("issues independent 256-bit URL-safe secrets and hashes only the presented token", () => {
    const first = newAccountToken(); const second = newAccountToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.hash).toHaveLength(64); expect(first.hash).toBe(accountHash(first.token));
    expect(first.token).not.toBe(second.token); expect(first.hash).not.toBe(first.token);
    expect(accountResetInput.safeParse({ token: first.token, password: input.password }).success).toBe(true);
    expect(accountResetInput.safeParse({ token: "bad", password: input.password }).success).toBe(false);
  });

  it("requires exact same-origin JSON mutations, including on localhost", () => {
    expect(accountOrigin("http://localhost:3000/api/account/signup", new Headers({ origin: local.APP_URL! }), local)).toBe(local.APP_URL);
    const rejectedHeaders: Record<string, string>[] = [{}, { origin: "http://evil.test" }, { origin: local.APP_URL!, "sec-fetch-site": "cross-site" }];
    for (const headers of rejectedHeaders) {
      expect(() => accountOrigin(`${local.APP_URL}/api/account/signup`, new Headers(headers), local)).toThrow("origin_rejected");
    }
    expect(() => accountOrigin("http://127.0.0.1:3000/api/account/signup", new Headers({ origin: local.APP_URL! }), local)).toThrow("origin_rejected");
    expect(() => accountOrigin(`${local.APP_URL}/api/account/signup`, new Headers({ origin: local.APP_URL! }), { ...local, NODE_ENV: "production" })).toThrow("service_unavailable");
  });

  it("keeps local inbox inaccessible in production or through remote proxy addresses", () => {
    const url = `${local.APP_URL}/auth`;
    expect(localMailPreviewAllowed(url, new Headers(), local)).toBe(true);
    expect(localMailPreviewAllowed(url, new Headers({ "x-forwarded-for": "::1, 127.0.0.1" }), local)).toBe(true);
    const rejectedHeaders: Record<string, string>[] = [{ "x-forwarded-for": "203.0.113.1, 127.0.0.1" }, { forwarded: "for=127.0.0.1" }, { "sec-fetch-site": "cross-site" }];
    for (const headers of rejectedHeaders) expect(localMailPreviewAllowed(url, new Headers(headers), local)).toBe(false);
    expect(localMailPreviewAllowed(url, new Headers(), { ...local, NODE_ENV: "production" })).toBe(false);
    expect(localMailPreviewAllowed("https://example.test/auth", new Headers(), { ...local, APP_URL: "https://example.test" })).toBe(false);
    expect(localMailPreviewAllowed(url, new Headers(), { ...local, MAIL_PREVIEW_ENABLED: "false" })).toBe(false);
  });

  it("accepts a configured HTTPS proxy only with the exact public host and browser origin", () => {
    const env={NODE_ENV:'production',APP_URL:'https://pilot.example.test',TRUST_PROXY:'true'} as NodeJS.ProcessEnv;
    const headers={host:'pilot.example.test',origin:env.APP_URL!,'x-forwarded-proto':'https','x-forwarded-host':'pilot.example.test'};
    const internal='http://127.0.0.1:3001/api/account/signup';
    expect(accountOrigin(internal,new Headers(headers),env)).toBe(env.APP_URL);
    expect(accountOrigin(internal,new Headers({...headers,'x-forwarded-host':'PILOT.EXAMPLE.TEST'}),env)).toBe(env.APP_URL);
    const rejected:Record<string,string>[]=[{host:'foreign.example.test'},{origin:'https://foreign.example.test'},{origin:''},{'x-forwarded-host':'foreign.example.test'},{'x-forwarded-host':'pilot.example.test, foreign.example.test'},{'x-forwarded-proto':'http'},{'x-forwarded-proto':'https,http'},{'sec-fetch-site':'cross-site'}];
    for(const change of rejected)
      expect(()=>accountOrigin(internal,new Headers({...headers,...change}),env)).toThrow('origin_rejected');
    expect(()=>accountOrigin(internal,new Headers(headers),{...env,TRUST_PROXY:'false'})).toThrow('origin_rejected');
    expect(()=>accountOrigin(internal,new Headers(headers),{...env,NODE_ENV:'development'})).toThrow('origin_rejected');
  });

  it("ignores spoofed proxy prefixes for network rate limits and normalizes valid IP identities",()=>{
    const env={NODE_ENV:'production',TRUST_PROXY:'true'} as NodeJS.ProcessEnv;
    const header=(value:string)=>new Headers({'x-forwarded-for':value});
    expect(accountRateIdentity(header('198.51.100.10,203.0.113.20'),env)).toBe('203.0.113.20');
    expect(accountRateIdentity(header('attacker-controlled,203.0.113.20'),env)).toBe('203.0.113.20');
    expect(accountRateIdentity(header('203.0.113.20,10.0.0.1'),{...env,TRUST_PROXY_HOPS:'2'})).toBe('203.0.113.20');
    expect(accountRateIdentity(header('2001:0DB8:0:0:0:0:0:1'),env)).toBe('2001:db8::1');
    for(const value of ['', 'not-an-ip', '203.0.113.1:8080'])expect(accountRateIdentity(header(value),env)).toBe('direct');
    for(const hops of ['0','6','1.5','invalid'])expect(accountRateIdentity(header('203.0.113.20'),{...env,TRUST_PROXY_HOPS:hops})).toBe('direct');
    expect(accountRateIdentity(header('203.0.113.20'),{...env,TRUST_PROXY:'false'})).toBe('direct');
  });

  it("bounds actual request bytes and rejects malformed or wrong media types", async () => {
    const request = (body: string, contentType = "application/json") => new Request("http://localhost/api/account/signup", { method: "POST", headers: { "Content-Type": contentType, "Content-Length": "1" }, body });
    await expect(readAccountJson(request('{"a":1}'))).resolves.toEqual({ a: 1 });
    await expect(readAccountJson(request("x".repeat(100)), 50)).rejects.toMatchObject({ code: "request_too_large", status: 413 });
    await expect(readAccountJson(request("{"))).rejects.toMatchObject({ code: "invalid_request" });
    await expect(readAccountJson(request("{}", "text/plain"))).rejects.toMatchObject({ status: 415 });
  });

  it("provides all visible copy in each supported language", () => {
    expect(Object.keys(accountCopy.ru).sort()).toEqual(Object.keys(accountCopy.en).sort());
    expect(Object.keys(accountCopy.kk).sort()).toEqual(Object.keys(accountCopy.en).sort());
    for (const locale of Object.values(accountCopy)) for (const value of Object.values(locale)) expect(value.trim().length).toBeGreaterThan(0);
  });
});

describe("prepared Resend adapter without external requests", () => {
  const message = { to: "synthetic@example.test", subject: "Test message", text: "Synthetic payload", actionUrl: "http://localhost/auth#token=synthetic", locale: "en" as const, purpose: "verify_email" as const };
  const configured: NodeJS.ProcessEnv = { NODE_ENV: "test", MAIL_TRANSPORT: "resend", MAIL_ENABLE_EXTERNAL_DELIVERY: "true", RESEND_API_KEY: "synthetic-test-key", MAIL_FROM: "test@example.test", SECRETS_ENCRYPTION_KEY: "synthetic-encryption-key-for-tests-only" };

  it("requires explicit delivery enablement and never falls back from local to network", async () => {
    const send = vi.fn<typeof fetch>();
    expect(resendConfigured(local)).toBe(false);
    expect(resendConfigured({ ...configured, MAIL_ENABLE_EXTERNAL_DELIVERY: undefined })).toBe(false);
    await expect(createResendMailTransport(local, send).send(message, "test-id")).rejects.toThrow("external_delivery_disabled");
    expect(send).not.toHaveBeenCalled();
  });

  it("sends the documented payload and stable idempotency key through an injected mock", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ id: "mock-message" }), { status: 200 }));
    await expect(createResendMailTransport(configured, send).send(message, "account-mail/test-id")).resolves.toEqual({ providerMessageId: "mock-message" });
    const [url, options] = send.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(options?.headers).get("Idempotency-Key")).toBe("account-mail/test-id");
    expect(JSON.parse(String(options?.body))).toEqual({ from: configured.MAIL_FROM, to: [message.to], subject: message.subject, text: message.text });
  });

  it("does not expose provider response bodies on delivery failure", async () => {
    const send = vi.fn<typeof fetch>().mockResolvedValue(new Response("sensitive-provider-body", { status: 429 }));
    await expect(createResendMailTransport(configured, send).send(message, "test-id")).rejects.toThrow("delivery_failed");
  });
});
