import type { AccountMailTransport } from "./account-mail";

/** Prepared provider adapter. No network call is made by importing this module.
 * External delivery requires every explicit setting; local development stays local.
 * Contract: https://resend.com/docs/api-reference/emails/send-email
 */
export function resendConfigured(env: NodeJS.ProcessEnv = process.env) {
  return env.MAIL_TRANSPORT === "resend" && env.MAIL_ENABLE_EXTERNAL_DELIVERY === "true"
    && Boolean(env.RESEND_API_KEY) && Boolean(env.MAIL_FROM)
    && (env.SECRETS_ENCRYPTION_KEY?.length ?? 0) >= 32;
}

export function createResendMailTransport(env: NodeJS.ProcessEnv = process.env, send: typeof fetch = fetch): AccountMailTransport {
  return {
    async send(message, idempotencyKey) {
      if (!resendConfigured(env)) throw new Error("external_delivery_disabled");
      const response = await send("https://api.resend.com/emails", {
        method: "POST", signal: AbortSignal.timeout(8_000),
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({ from: env.MAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
      });
      if (!response.ok) throw new Error("delivery_failed");
      const body = await response.json() as { id?: unknown };
      if (typeof body.id !== "string") throw new Error("invalid_provider_response");
      return { providerMessageId: body.id };
    },
  };
}
