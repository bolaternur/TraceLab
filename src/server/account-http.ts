import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createSession, destroySession, getCurrentUser } from "./auth";
import { AccountError, accountHash, accountOrigin, accountRateIdentity, localMailPreviewAllowed, newAccountToken, readAccountJson, type AccountAction } from "./account-contract";
import { authenticateAccount, registerAccount, requestAccountEmail, resetAccountPassword, verifyAccountEmail, type AccountContext } from "./account-service";
import { flushAccountMail, listLocalAccountMail } from "./account-mail";

const privateHeaders = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
export function accountResponse(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: privateHeaders }); }

async function requestContext(request: Request): Promise<AccountContext> {
  const origin = accountOrigin(request.url, request.headers);
  const jar = await cookies();
  let previewKeyHash: string | null = null;
  if (localMailPreviewAllowed(request.url, request.headers)) {
    let mailbox = jar.get("pt_mailbox")?.value;
    if (!mailbox || !/^[A-Za-z0-9_-]{43}$/.test(mailbox)) {
      mailbox = newAccountToken().token;
      jar.set("pt_mailbox", mailbox, { httpOnly: true, sameSite: "strict", secure: false, path: "/", maxAge: 86_400 });
    }
    previewKeyHash = accountHash(mailbox);
  }
  return { origin, previewKeyHash, rateIdentity: accountRateIdentity(request.headers) };
}

export async function accountMutation(action: AccountAction, request: Request) {
  try {
    const ctx = await requestContext(request);
    const raw = await readAccountJson(request);
    if (action === "signup" || action === "resend" || action === "forgot") {
      const result = action === "signup" ? await registerAccount(raw, ctx) : await requestAccountEmail(raw, action === "resend" ? "verify_email" : "reset_password", ctx);
      after(async () => { await flushAccountMail().catch(() => undefined); });
      return accountResponse(result, 202);
    }
    if (action === "verify") return accountResponse(await verifyAccountEmail(raw, ctx));
    if (action === "reset") return accountResponse(await resetAccountPassword(raw, ctx));
    if (action === "signin") {
      const result = await authenticateAccount(raw, ctx);
      await createSession(result.user.id, result.credentialHash);
      (await cookies()).set("pt_lang", result.user.locale, { sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 31_536_000 });
      return accountResponse({ ok: true, code: "signed_in", next: result.next });
    }
    await destroySession();
    return accountResponse({ ok: true, code: "signed_out" });
  } catch (error) {
    if (error instanceof AccountError) {
      const response = accountResponse({ ok: false, code: error.code }, error.status);
      if (error.status === 429) response.headers.set("Retry-After", "900");
      return response;
    }
    if (error instanceof ZodError) return accountResponse({ ok: false, code: "invalid_fields", fields: [...new Set(error.issues.map(issue => issue.path[0]).filter(value => typeof value === "string"))] }, 400);
    // Do not serialize DB errors, credentials, or token-bearing request bodies.
    console.error(JSON.stringify({ level: "error", event: "account_request_failed", action }));
    return accountResponse({ ok: false, code: "service_unavailable" }, 503);
  }
}

export async function accountSession() {
  try {
    const user = await getCurrentUser();
    return accountResponse({ user: user ? { id: user.id, displayName: user.displayName, locale: user.locale } : null });
  } catch { return accountResponse({ ok: false, code: "service_unavailable" }, 503); }
}

export async function accountMailPreview(request: Request) {
  if (!localMailPreviewAllowed(request.url, request.headers)) return accountResponse({ ok: false, code: "not_found" }, 404);
  try {
    let filter: { email: string; purpose: "verify_email" | "reset_password" } | undefined;
    if (request.method === "POST") {
      accountOrigin(request.url, request.headers);
      filter = z.object({
        email: z.string().trim().toLowerCase().email().max(254),
        purpose: z.enum(["verify_email", "reset_password"]),
      }).strict().parse(await readAccountJson(request, 4096));
    }
    const key = (await cookies()).get("pt_mailbox")?.value;
    if (!key || !/^[A-Za-z0-9_-]{43}$/.test(key)) return accountResponse({ messages: [], localOnly: true });
    return accountResponse({ messages: await listLocalAccountMail(accountHash(key), filter), localOnly: true });
  } catch (error) {
    if (error instanceof AccountError) return accountResponse({ ok: false, code: error.code }, error.status);
    if (error instanceof ZodError) return accountResponse({ ok: false, code: "invalid_fields" }, 400);
    return accountResponse({ ok: false, code: "service_unavailable" }, 503);
  }
}
