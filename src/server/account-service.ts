import type { PoolClient } from "pg";
import { pool } from "@/db";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./auth";
import { accountEmailInput, AccountError, accountHash, accountResetInput, accountSigninInput, accountSignupInput, accountTokenInput, newAccountToken, type AccountLocale } from "./account-contract";
import { buildAccountMail, queueAccountMail, requireAccountMailTransport } from "./account-mail";

export type AccountContext = { origin: string; rateIdentity: string; previewKeyHash: string | null };
type UserRow = { id: string; email: string; display_name: string; locale: AccountLocale; password_hash: string; verified_at: Date | null };

async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const value = await work(client); await client.query("COMMIT"); return value; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function consumeRate(key: string, maximum: number) {
  const window = new Date(Math.floor(Date.now() / 900_000) * 900_000);
  const result = await pool.query<{ attempts: number }>(
    `INSERT INTO account_rate_limits(key_hash,window_started_at,attempts) VALUES($1,$2,1)
     ON CONFLICT(key_hash) DO UPDATE SET
       attempts=CASE WHEN account_rate_limits.window_started_at=EXCLUDED.window_started_at THEN account_rate_limits.attempts+1 ELSE 1 END,
       window_started_at=EXCLUDED.window_started_at RETURNING attempts`, [accountHash(key), window],
  );
  if (result.rows[0].attempts > maximum) throw new AccountError("rate_limited", 429);
}

export async function accountRateLimit(action: string, identity: string, ctx: AccountContext) {
  // Global cap bounds both expensive hashing and rate-key cardinality. Proxy
  // addresses are used only when the deployment explicitly trusts its proxy.
  await consumeRate(`global:${action}`, 120);
  await consumeRate(`network:${action}:${ctx.rateIdentity}`, 40);
  await consumeRate(`identity:${action}:${identity}`, action === "signin" ? 8 : 5);
}

async function issueToken(client: PoolClient, user: Pick<UserRow, "id" | "email">, locale: AccountLocale, purpose: "verify_email" | "reset_password", next: string, ctx: AccountContext) {
  const { token, hash } = newAccountToken();
  await client.query("UPDATE account_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose=$2 AND consumed_at IS NULL", [user.id, purpose]);
  await client.query(
    "INSERT INTO account_tokens(token_hash,user_id,purpose,expires_at,next_path) VALUES($1,$2,$3,$4,$5)",
    [hash, user.id, purpose, new Date(Date.now() + (purpose === "verify_email" ? 3_600_000 : 1_800_000)), next],
  );
  await queueAccountMail(client, user.id, buildAccountMail(user.email, locale, purpose, token, ctx.origin), ctx.previewKeyHash);
}

export async function registerAccount(raw: unknown, ctx: AccountContext) {
  const input = accountSignupInput.parse(raw);
  requireAccountMailTransport();
  await accountRateLimit("signup", input.email, ctx);
  // Hash also for duplicate addresses so the response does not reveal existence.
  const passwordHash = await hashPassword(input.password);
  await transaction(async client => {
    const existing = await client.query("SELECT id FROM users WHERE lower(email)=$1 LIMIT 1", [input.email]);
    if (existing.rowCount) return;
    const inserted = await client.query<{ id: string; email: string }>(
      "INSERT INTO users(email,password_hash,display_name,locale) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id,email",
      [input.email, passwordHash, input.displayName, input.locale],
    );
    if (!inserted.rows[0]) return;
    const user = inserted.rows[0];
    await client.query("INSERT INTO account_verification(user_id) VALUES($1)", [user.id]);
    await issueToken(client, user, input.locale, "verify_email", input.next, ctx);
  });
  return { ok: true as const, code: "email_requested" };
}

export async function requestAccountEmail(raw: unknown, purpose: "verify_email" | "reset_password", ctx: AccountContext) {
  const input = accountEmailInput.parse(raw);
  requireAccountMailTransport();
  await accountRateLimit(purpose, input.email, ctx);
  await transaction(async client => {
    const result = await client.query<UserRow>(
      "SELECT u.*,v.verified_at FROM users u LEFT JOIN account_verification v ON v.user_id=u.id WHERE lower(u.email)=$1 LIMIT 1 FOR UPDATE OF u", [input.email],
    );
    const user = result.rows[0];
    if (!user || (purpose === "verify_email" && user.verified_at)) return;
    await issueToken(client, user, input.locale, purpose, input.next, ctx);
  });
  return { ok: true as const, code: "email_requested" };
}

export async function authenticateAccount(raw: unknown, ctx: AccountContext) {
  const input = accountSigninInput.parse(raw);
  await accountRateLimit("signin", input.email, ctx);
  const result = await pool.query<UserRow>(
    "SELECT u.*,v.verified_at FROM users u LEFT JOIN account_verification v ON v.user_id=u.id WHERE lower(u.email)=$1 LIMIT 1", [input.email],
  );
  const user = result.rows[0];
  const valid = await verifyPassword(input.password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
  if (!user || !valid || !user.verified_at) throw new AccountError("invalid_credentials", 401);
  const locale = input.locale ?? user.locale;
  if (locale !== user.locale) await pool.query("UPDATE users SET locale=$1 WHERE id=$2", [locale, user.id]);
  const memberships = await pool.query("SELECT id FROM team_memberships WHERE user_id=$1 AND status='active' LIMIT 1", [user.id]);
  const next = input.next.startsWith("/join/") || memberships.rowCount ? input.next : `/onboarding?next=${encodeURIComponent(input.next)}`;
  return { user: { id: user.id, displayName: user.display_name, locale }, next, credentialHash: user.password_hash };
}

export async function verifyAccountEmail(raw: unknown, ctx: AccountContext) {
  const input = accountTokenInput.parse(raw);
  const hash = accountHash(input.token);
  await accountRateLimit("verify", hash, ctx);
  return transaction(async client => {
    const result = await client.query<{ user_id: string; next_path: string }>(
      "SELECT user_id,next_path FROM account_tokens WHERE token_hash=$1 AND purpose='verify_email' AND consumed_at IS NULL AND expires_at>now() FOR UPDATE", [hash],
    );
    const token = result.rows[0];
    if (!token) throw new AccountError("invalid_token");
    await client.query("INSERT INTO account_verification(user_id,verified_at) VALUES($1,now()) ON CONFLICT(user_id) DO UPDATE SET verified_at=EXCLUDED.verified_at", [token.user_id]);
    await client.query("UPDATE account_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose='verify_email' AND consumed_at IS NULL", [token.user_id]);
    return { ok: true as const, code: "email_verified", next: `/auth?mode=signin&next=${encodeURIComponent(token.next_path)}` };
  });
}

export async function resetAccountPassword(raw: unknown, ctx: AccountContext) {
  const input = accountResetInput.parse(raw);
  const hash = accountHash(input.token);
  await accountRateLimit("reset", hash, ctx);
  const passwordHash = await hashPassword(input.password);
  await transaction(async client => {
    const result = await client.query<{ user_id: string }>(
      "SELECT user_id FROM account_tokens WHERE token_hash=$1 AND purpose='reset_password' AND consumed_at IS NULL AND expires_at>now() FOR UPDATE", [hash],
    );
    const token = result.rows[0];
    if (!token) throw new AccountError("invalid_token");
    await client.query("UPDATE users SET password_hash=$1 WHERE id=$2", [passwordHash, token.user_id]);
    await client.query("DELETE FROM sessions WHERE user_id=$1", [token.user_id]);
    await client.query("UPDATE account_tokens SET consumed_at=now() WHERE user_id=$1 AND purpose='reset_password' AND consumed_at IS NULL", [token.user_id]);
  });
  return { ok: true as const, code: "password_reset" };
}
