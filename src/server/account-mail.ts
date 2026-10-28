import type { PoolClient } from "pg";
import { pool } from "@/db";
import { decryptSecret, encryptSecret } from "@/server/storage";
import { AccountError, accountHash, type AccountLocale } from "./account-contract";
import { createResendMailTransport, resendConfigured } from "./account-mail-resend";

export type MailPurpose = "verify_email" | "reset_password";
export type AccountMail = { to: string; subject: string; text: string; actionUrl: string; locale: AccountLocale; purpose: MailPurpose };
/** Local and prepared production providers share the same bounded delivery contract. */
export interface AccountMailTransport {
  send(message: AccountMail, idempotencyKey: string): Promise<{ providerMessageId: string }>;
}
const mailCopy = {
  en: { verify: "Confirm your TraceLab email", reset: "Reset your TraceLab password", verifyText: "Confirm this email address to use your TraceLab account.", resetText: "Use this link to choose a new password. Your existing sessions will be signed out.", ignore: "If you did not request this, ignore this email. This link can be used only once." },
  ru: { verify: "Подтвердите почту TraceLab", reset: "Сброс пароля TraceLab", verifyText: "Подтвердите этот адрес почты, чтобы пользоваться аккаунтом TraceLab.", resetText: "Перейдите по ссылке, чтобы задать новый пароль. Все текущие сессии будут завершены.", ignore: "Если вы не отправляли запрос, проигнорируйте письмо. Ссылку можно использовать только один раз." },
  kk: { verify: "TraceLab поштаңызды растаңыз", reset: "TraceLab құпиясөзін қалпына келтіру", verifyText: "TraceLab аккаунтын пайдалану үшін осы пошта мекенжайын растаңыз.", resetText: "Жаңа құпиясөз орнату үшін сілтемені ашыңыз. Барлық ағымдағы сеанстар аяқталады.", ignore: "Бұл сұрауды жібермесеңіз, хатты елемеңіз. Сілтемені тек бір рет қолдануға болады." },
} satisfies Record<AccountLocale, Record<string, string>>;

export function buildAccountMail(to: string, locale: AccountLocale, purpose: MailPurpose, token: string, origin: string): AccountMail {
  const copy = mailCopy[locale];
  const mode = purpose === "verify_email" ? "verify" : "reset";
  const actionUrl = `${origin}/auth?mode=${mode}&locale=${locale}#token=${encodeURIComponent(token)}`;
  const subject = purpose === "verify_email" ? copy.verify : copy.reset;
  const intro = purpose === "verify_email" ? copy.verifyText : copy.resetText;
  return { to, locale, purpose, subject, actionUrl, text: `${intro}\n\n${actionUrl}\n\n${copy.ignore}` };
}

export function requireAccountMailTransport() {
  if (process.env.MAIL_TRANSPORT === "local" && process.env.NODE_ENV !== "production") return "local" as const;
  if (resendConfigured()) return "production" as const;
  throw new AccountError("mail_unavailable", 503);
}

export async function queueAccountMail(client: PoolClient, userId: string, message: AccountMail, previewKeyHash: string | null) {
  const transport = requireAccountMailTransport();
  const result = await client.query<{ id: string }>(
    `INSERT INTO account_mail_outbox(user_id,payload_ciphertext,preview_key_hash,transport,status)
     VALUES($1,$2,$3,$4,$5) RETURNING id`,
    [userId, encryptSecret(JSON.stringify(message)), transport === "local" ? previewKeyHash : null, transport, transport === "local" ? "preview" : "queued"],
  );
  return result.rows[0].id;
}

/** An explicit worker call can retry durable deliveries; local mode makes no requests. */
export async function flushAccountMail(limit = 8) {
  if (!resendConfigured()) return { processed: 0, sent: 0, failed: 0, exhausted: 0 };
  const count = Math.max(1, Math.min(20, Math.trunc(limit)));
  const result = await pool.query<{ id: string; payload_ciphertext: string; attempts: number }>(
    `WITH eligible AS (
       SELECT id FROM account_mail_outbox WHERE transport='production' AND attempts<3
       AND ((status IN ('queued','failed') AND next_attempt_at<=now()) OR (status='sending' AND locked_at<now()-interval '2 minutes'))
       AND created_at>now()-interval '1 day'
       ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1
     ) UPDATE account_mail_outbox m SET status='sending',locked_at=now(),attempts=m.attempts+1
       FROM eligible e WHERE m.id=e.id RETURNING m.id,m.payload_ciphertext,m.attempts`, [count],
  );
  const transport = createResendMailTransport();
  let sent = 0, failed = 0;
  for (const row of result.rows) {
    try {
      await transport.send(JSON.parse(decryptSecret(row.payload_ciphertext)) as AccountMail, `account-mail/${row.id}`);
      await pool.query("UPDATE account_mail_outbox SET status='sent',completed_at=now(),locked_at=NULL,last_error=NULL WHERE id=$1", [row.id]);
      sent++;
    } catch {
      await pool.query("UPDATE account_mail_outbox SET status='failed',last_error='delivery_failed',locked_at=NULL,next_attempt_at=now()+($2*interval '1 minute') WHERE id=$1", [row.id, row.attempts * 2]);
      failed++;
    }
  }
  const exhausted = Number((await pool.query<{ count: string }>(`SELECT count(*) FROM account_mail_outbox WHERE transport='production'
    AND (status IN ('queued','failed') OR (status='sending' AND locked_at<now()-interval '2 minutes'))
    AND (attempts>=3 OR created_at<=now()-interval '1 day')`)).rows[0].count);
  return { processed: result.rowCount ?? 0, sent, failed, exhausted };
}

export async function listLocalAccountMail(previewKeyHash: string, filter?: { email: string; purpose: MailPurpose }) {
  const result = await pool.query<{ id: string; user_id: string; payload_ciphertext: string; created_at: Date }>(
    `SELECT id,user_id,payload_ciphertext,created_at FROM account_mail_outbox
     WHERE transport='local' AND status='preview' AND preview_key_hash=$1
     AND created_at>now()-interval '1 day' ORDER BY created_at DESC,id DESC LIMIT 50`, [previewKeyHash],
  );
  const candidates = result.rows.flatMap(row => {
    try {
      const message = JSON.parse(decryptSecret(row.payload_ciphertext)) as AccountMail;
      if (!message || typeof message.to !== "string" || typeof message.subject !== "string"
        || typeof message.actionUrl !== "string" || !["verify_email", "reset_password"].includes(message.purpose)) return [];
      if (filter && (message.to.trim().toLowerCase() !== filter.email || message.purpose !== filter.purpose)) return [];
      const url = new URL(message.actionUrl);
      const token = new URLSearchParams(url.hash.slice(1)).get("token");
      const mode = message.purpose === "verify_email" ? "verify" : "reset";
      if (!["http:", "https:"].includes(url.protocol) || url.pathname !== "/auth" || url.searchParams.get("mode") !== mode
        || !token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return [];
      return [{ row, message, tokenHash: accountHash(token) }];
    } catch {
      // A damaged local preview must not disclose its encrypted contents or hide other valid messages.
      return [];
    }
  });
  if (!candidates.length) return [];
  const active = await pool.query<{ token_hash: string; user_id: string; purpose: MailPurpose }>(
    `SELECT token_hash,user_id,purpose FROM account_tokens
     WHERE token_hash=ANY($1::text[]) AND consumed_at IS NULL AND expires_at>now()`,
    [candidates.map(candidate => candidate.tokenHash)],
  );
  const liveTokens = new Set(active.rows.map(token => `${token.user_id}:${token.purpose}:${token.token_hash}`));
  return candidates.filter(({ row, message, tokenHash }) => liveTokens.has(`${row.user_id}:${message.purpose}:${tokenHash}`))
    .slice(0, 15).map(({ row, message }) => ({
      id: row.id, subject: message.subject, actionUrl: message.actionUrl, purpose: message.purpose, createdAt: row.created_at,
    }));
}
