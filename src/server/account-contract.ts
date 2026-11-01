import { createHash, randomBytes } from "node:crypto";
import {isIP} from "node:net";
import { z } from "zod";
import { safeInternalPath } from "@/lib/security";

export const accountLocale = z.enum(["ru", "en", "kk"]);
export type AccountLocale = z.infer<typeof accountLocale>;
const email = z.string().trim().toLowerCase().email().max(254);
export const accountPassword = z.string().min(12).max(128);
const next = z.string().max(2048).optional().transform(value => safeInternalPath(value, "/workspace/"));
export const accountEmailInput = z.object({ email, locale: accountLocale.default("en"), next });
export const accountSignupInput = accountEmailInput.extend({ displayName: z.string().trim().min(1).max(80), password: accountPassword });
export const accountSigninInput = z.object({ email, password: z.string().min(1).max(200), locale: accountLocale.optional(), next });
export const accountTokenInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export const accountResetInput = accountTokenInput.extend({ password: accountPassword });
export type AccountAction = "signup" | "signin" | "resend" | "forgot" | "verify" | "reset" | "logout";

export class AccountError extends Error {
  constructor(public code: string, public status = 400) { super(code); this.name = "AccountError"; }
}
export function accountHash(value: string) { return createHash("sha256").update(value).digest("hex"); }
export function newAccountToken() { const token = randomBytes(32).toString("base64url"); return { token, hash: accountHash(token) }; }
export function isLoopbackUrl(value: string) {
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(value).hostname); } catch { return false; }
}

export function accountOrigin(requestUrl: string, requestHeaders: Headers, env: NodeJS.ProcessEnv = process.env) {
  const url = new URL(requestUrl);
  const configured = env.APP_URL ? new URL(env.APP_URL).origin : null;
  if (env.NODE_ENV === "production" && (!configured || !configured.startsWith("https://"))) throw new AccountError("service_unavailable", 503);
  const expected = configured ?? (isLoopbackUrl(url.origin) && env.NODE_ENV !== "production" ? url.origin : null);
  // TLS terminates at the deployment proxy; Next may construct request.url from
  // its internal HTTP listener. Accept that transport only when explicitly
  // configured and every public host/protocol signal agrees with APP_URL.
  // Browser Origin remains mandatory and must match the configured origin.
  const publicHost = expected ? new URL(expected).host.toLowerCase() : null;
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const trustedProxy = env.NODE_ENV === "production" && env.TRUST_PROXY === "true" && Boolean(publicHost)
    && requestHeaders.get("host")?.toLowerCase() === publicHost
    && requestHeaders.get("x-forwarded-proto") === "https"
    && (!forwardedHost || forwardedHost.toLowerCase() === publicHost);
  if (!expected || (url.origin !== expected && !trustedProxy) || requestHeaders.get("origin") !== expected || requestHeaders.get("sec-fetch-site") === "cross-site") throw new AccountError("origin_rejected", 403);
  return expected;
}

/** Trust only the configured proxy's suffix, never a caller-supplied XFF prefix.
 * The deployment must block direct access and verify its trusted proxy count. */
export function accountRateIdentity(requestHeaders:Headers,env:NodeJS.ProcessEnv=process.env){
  if(env.TRUST_PROXY!=="true")return "direct";
  const hops=Number(env.TRUST_PROXY_HOPS??"1"),raw=requestHeaders.get("x-forwarded-for")||"";
  if(!Number.isInteger(hops)||hops<1||hops>5||raw.length>2048)return "direct";
  const chain=raw.split(',').map(value=>value.trim()),address=chain[chain.length-hops];
  if(!address||!isIP(address))return "direct";
  return isIP(address)===6?new URL(`http://[${address}]/`).hostname.slice(1,-1):address;
}

export function localMailPreviewAllowed(url: string, requestHeaders: Headers, env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== "development" || env.MAIL_TRANSPORT !== "local" || env.MAIL_PREVIEW_ENABLED !== "true") return false;
  if (!isLoopbackUrl(url) || !env.APP_URL || !isLoopbackUrl(env.APP_URL)) return false;
  if (new URL(url).origin !== new URL(env.APP_URL).origin) return false;
  if (requestHeaders.has("forwarded")) return false;
  // Next's local server adds X-Forwarded-For itself. Accept only a complete
  // loopback chain; any remote/proxied client address disables the preview.
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor && !forwardedFor.split(",").every(address => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address.trim()))) return false;
  return requestHeaders.get("sec-fetch-site") !== "cross-site";
}

export async function readAccountJson(request: Request, maxBytes = 16_384) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new AccountError("invalid_request", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError("invalid_request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new AccountError("request_too_large", 413); }
      chunks.push(chunk.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError("invalid_request");
  } finally { reader.releaseLock(); }
}
