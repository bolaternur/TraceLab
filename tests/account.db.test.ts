import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { accountHash } from "@/server/account-contract";

const cookieState = vi.hoisted(() => ({ values: new Map<string, string>(), options: new Map<string, Record<string, unknown>>() }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => cookieState.values.has(name) ? { value: cookieState.values.get(name)! } : undefined,
  set: (name: string, value: string, options: Record<string, unknown>) => { cookieState.values.set(name, value); cookieState.options.set(name, options); },
  delete: (name: string) => cookieState.values.delete(name),
}) }));

// Opt-in only: these fixtures own only randomized account-test-* users. No
// existing user, team, session or mailbox is cleared by this suite.
const enabled = process.env.RUN_ACCOUNT_DB_TESTS === "true" && Boolean(process.env.DATABASE_URL);
describe.skipIf(!enabled)("account lifecycle against PostgreSQL", () => {
  let pool: Pool;
  let service: typeof import("@/server/account-service");
  let mail: typeof import("@/server/account-mail");
  let auth: typeof import("@/server/auth");
  const ids: string[] = [];
  const runId = randomUUID();
  const ctx = { origin: "http://localhost:3000", rateIdentity: `account-test-${runId}`, previewKeyHash: accountHash(`mailbox-${runId}`) };
  const password = "Synthetic-Test-Password-2026!";
  const originalTransport = process.env.MAIL_TRANSPORT;

  beforeAll(async () => {
    process.env.MAIL_TRANSPORT = "local";
    ({ pool } = await import("@/db"));
    const database = await pool.query<{ name: string }>("SELECT current_database() AS name");
    if (!/^tracelab_unified_(dev_20261026|test(?:_.*)?)$/.test(database.rows[0].name)) throw new Error("Use the dedicated Iznera development or test database.");
    service = await import("@/server/account-service");
    mail = await import("@/server/account-mail");
    auth = await import("@/server/auth");
  });
  afterAll(async () => {
    if (ids.length) await pool.query("DELETE FROM users WHERE id=ANY($1::uuid[]) AND email LIKE 'account-test-%@example.test'", [ids]);
    if (originalTransport === undefined) delete process.env.MAIL_TRANSPORT; else process.env.MAIL_TRANSPORT = originalTransport;
    await pool?.end();
  });
  async function create(label: string, next = "/workspace/", context = ctx) {
    const email = `account-test-${runId}-${label}@example.test`;
    await service.registerAccount({ email, password, displayName: "Account test", locale: "ru", next }, context);
    const user = (await pool.query<{ id: string }>("SELECT id FROM users WHERE email=$1", [email])).rows[0];
    ids.push(user.id);
    return { email, id: user.id };
  }
  async function latestToken(userId: string, purpose: string) {
    const row = (await pool.query<{ id: string }>("SELECT id FROM account_mail_outbox WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [userId])).rows[0];
    const messages = await mail.listLocalAccountMail(ctx.previewKeyHash);
    const message = messages.find(item => item.id === row.id)!;
    const url = new URL(message.actionUrl);
    expect(url.searchParams.get("mode")).toBe(purpose === "verify_email" ? "verify" : "reset");
    return new URLSearchParams(url.hash.slice(1)).get("token")!;
  }

  it("requires verification, hashes the token, consumes it once and retains invite/locale", async () => {
    const user = await create("verify", "/join/synthetic-invite");
    await expect(service.authenticateAccount({ email: user.email, password }, ctx)).rejects.toMatchObject({ code: "invalid_credentials" });
    const token = await latestToken(user.id, "verify_email");
    const rows = await pool.query("SELECT token_hash FROM account_tokens WHERE user_id=$1", [user.id]);
    expect(rows.rows[0].token_hash === accountHash(token)).toBe(true);
    const outbox = await pool.query("SELECT payload_ciphertext FROM account_mail_outbox WHERE user_id=$1", [user.id]);
    expect(String(outbox.rows[0].payload_ciphertext).includes(token)).toBe(false);
    const verified = await Promise.allSettled([service.verifyAccountEmail({ token }, ctx), service.verifyAccountEmail({ token }, ctx)]);
    expect(verified.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(verified.filter(result => result.status === "rejected")).toHaveLength(1);
    const success = verified.find(result => result.status === "fulfilled") as PromiseFulfilledResult<{ next: string }>;
    expect(new URL(success.value.next, ctx.origin).searchParams.get("next")).toBe("/join/synthetic-invite");
    const signin = await service.authenticateAccount({ email: user.email, password, locale: "kk", next: "/join/synthetic-invite" }, ctx);
    expect(signin.user.locale).toBe("kk"); expect(signin.next).toBe("/join/synthetic-invite");
    expect(await mail.listLocalAccountMail(accountHash("different-browser"))).toEqual([]);
  });

  it("invalidates replaced links, separates purposes and expires links", async () => {
    const user = await create("tokens");
    const first = await latestToken(user.id, "verify_email");
    await service.requestAccountEmail({ email: user.email }, "verify_email", ctx);
    const second = await latestToken(user.id, "verify_email");
    expect(first === second).toBe(false);
    await expect(service.verifyAccountEmail({ token: first }, ctx)).rejects.toMatchObject({ code: "invalid_token" });
    await expect(service.resetAccountPassword({ token: second, password }, ctx)).rejects.toMatchObject({ code: "invalid_token" });
    await pool.query("UPDATE account_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [accountHash(second)]);
    await expect(service.verifyAccountEmail({ token: second }, ctx)).rejects.toMatchObject({ code: "invalid_token" });
  });

  it("resets credentials and revokes every existing session without auto sign-in", async () => {
    const user = await create("reset");
    await service.verifyAccountEmail({ token: await latestToken(user.id, "verify_email") }, ctx);
    await pool.query("INSERT INTO sessions(id,user_id,expires_at) VALUES($1,$3,now()+interval '1 day'),($2,$3,now()+interval '1 day')", [accountHash(randomUUID()), accountHash(randomUUID()), user.id]);
    await service.requestAccountEmail({ email: user.email }, "reset_password", ctx);
    const token = await latestToken(user.id, "reset_password");
    await expect(service.verifyAccountEmail({ token }, ctx)).rejects.toMatchObject({ code: "invalid_token" });
    await service.resetAccountPassword({ token, password: `${password}-new` }, ctx);
    expect((await pool.query("SELECT id FROM sessions WHERE user_id=$1", [user.id])).rowCount).toBe(0);
    await expect(service.resetAccountPassword({ token, password }, ctx)).rejects.toMatchObject({ code: "invalid_token" });
    await expect(service.authenticateAccount({ email: user.email, password }, ctx)).rejects.toMatchObject({ code: "invalid_credentials" });
    const signin = await service.authenticateAccount({ email: user.email, password: `${password}-new` }, ctx);
    expect(signin.next).toBe("/onboarding?next=%2Fworkspace%2F");
  });

  it("makes legacy accounts explicitly reverify and keeps unknown-email requests generic", async () => {
    const email = `account-test-${runId}-legacy@example.test`;
    const inserted = await pool.query<{ id: string }>("INSERT INTO users(email,password_hash,display_name,locale) VALUES($1,$2,'Legacy fixture','en') RETURNING id", [email, await auth.hashPassword(password)]);
    const id = inserted.rows[0].id; ids.push(id);
    await expect(service.authenticateAccount({ email, password }, ctx)).rejects.toMatchObject({ code: "invalid_credentials" });
    const existing = await service.requestAccountEmail({ email }, "verify_email", ctx);
    const unknown = await service.requestAccountEmail({ email: `account-test-${runId}-absent@example.test` }, "verify_email", ctx);
    expect(existing).toEqual(unknown);
    await service.verifyAccountEmail({ token: await latestToken(id, "verify_email") }, ctx);
    expect((await service.authenticateAccount({ email, password }, ctx)).user.id).toBe(id);
  });

  it("rotates hashed sessions, sets protected cookies and rejects stale credential proofs", async () => {
    const user = await create("session");
    await service.verifyAccountEmail({ token: await latestToken(user.id, "verify_email") }, ctx);
    const signin = await service.authenticateAccount({ email: user.email, password }, ctx);
    await auth.createSession(user.id, signin.credentialHash);
    const first = cookieState.values.get("pt_session")!;
    expect(cookieState.options.get("pt_session")).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect((await pool.query("SELECT id FROM sessions WHERE id=$1", [accountHash(first)])).rowCount).toBe(1);
    expect((await auth.getCurrentUser())?.id).toBe(user.id);
    await auth.createSession(user.id, signin.credentialHash);
    expect(cookieState.values.get("pt_session") === first).toBe(false);
    expect((await pool.query("SELECT id FROM sessions WHERE id=$1", [accountHash(first)])).rowCount).toBe(0);
    await service.requestAccountEmail({ email: user.email }, "reset_password", ctx);
    await service.resetAccountPassword({ token: await latestToken(user.id, "reset_password"), password: `${password}-rotated` }, ctx);
    await expect(auth.createSession(user.id, signin.credentialHash)).rejects.toThrow("Credentials changed");
    expect(await auth.getCurrentUser()).toBeNull();
    await auth.destroySession();
    expect(cookieState.values.has("pt_session")).toBe(false);
    expect(cookieState.values.has("pt_team")).toBe(false);
  });

  it("bounds repeated attempts atomically", async () => {
    const raw = { email: `account-test-${runId}-rate@example.test` };
    for (let index = 0; index < 5; index++) await service.requestAccountEmail(raw, "reset_password", ctx);
    await expect(service.requestAccountEmail(raw, "reset_password", ctx)).rejects.toMatchObject({ code: "rate_limited", status: 429 });
  });

  it("shows only the requested browser's matching live links and omits replaced, consumed and expired tokens", async () => {
    const otherContext = { ...ctx, previewKeyHash: accountHash(`other-mailbox-${runId}`) };
    const own = await create("preview-own");
    const other = await create("preview-other", "/workspace/", otherContext);
    const filter = { email: own.email, purpose: "verify_email" as const };
    const original = await mail.listLocalAccountMail(ctx.previewKeyHash, filter);
    expect(original).toHaveLength(1);
    expect(original[0]).toMatchObject({ purpose: "verify_email" });
    expect(original[0]).not.toHaveProperty("text"); expect(original[0]).not.toHaveProperty("to");
    expect((await mail.listLocalAccountMail(ctx.previewKeyHash)).some(message => message.id === original[0].id)).toBe(true);
    expect(await mail.listLocalAccountMail(ctx.previewKeyHash, { email: other.email, purpose: "verify_email" })).toEqual([]);
    expect(await mail.listLocalAccountMail(otherContext.previewKeyHash, filter)).toEqual([]);
    expect(await mail.listLocalAccountMail(ctx.previewKeyHash, { email: own.email, purpose: "reset_password" })).toEqual([]);

    await service.requestAccountEmail({ email: own.email }, "verify_email", ctx);
    const replacement = await mail.listLocalAccountMail(ctx.previewKeyHash, filter);
    expect(replacement).toHaveLength(1); expect(replacement[0].id).not.toBe(original[0].id);
    const token = new URLSearchParams(new URL(replacement[0].actionUrl).hash.slice(1)).get("token")!;
    await service.verifyAccountEmail({ token }, ctx);
    expect(await mail.listLocalAccountMail(ctx.previewKeyHash, filter)).toEqual([]);

    await service.requestAccountEmail({ email: own.email }, "reset_password", ctx);
    expect(await mail.listLocalAccountMail(ctx.previewKeyHash, { email: own.email, purpose: "reset_password" })).toHaveLength(1);
    await pool.query("UPDATE account_tokens SET expires_at=now()-interval '1 second' WHERE user_id=$1 AND purpose='reset_password'", [own.id]);
    expect(await mail.listLocalAccountMail(ctx.previewKeyHash, { email: own.email, purpose: "reset_password" })).toEqual([]);
  });
});
