import { authorizedCron } from "@/server/cron-auth";
import { resendConfigured } from "@/server/account-mail-resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

/** Invoke from a trusted scheduler. No recipients, links or provider responses are exposed. */
export async function POST(request: Request) {
  if (!authorizedCron(request.headers, process.env.CRON_SECRET)) return reply({ ok: false, code: "unauthorized" }, 401);
  if (!resendConfigured()) return reply({ ok: false, configured: false, code: "mail_not_configured", processed: 0 }, 503);
  try {
    const { flushAccountMail } = await import("@/server/account-mail");
    const result = await flushAccountMail();
    const failed = result.failed > 0 || result.exhausted > 0;
    return reply({ ok: !failed, configured: true, ...result }, failed ? 503 : 200);
  } catch {
    console.error(JSON.stringify({ level: "error", event: "account_mail_dispatch_failed" }));
    return reply({ ok: false, configured: true, code: "mail_dispatch_unavailable" }, 503);
  }
}
