import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { localMailPreviewAllowed } from "@/server/account-contract";
import { safeInternalPath } from "@/lib/security";
import { AuthForm, type AuthMode } from "./auth-form";
import type { AccountLocale } from "./account-copy";
import "./account.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "TraceLab · Account", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function AuthPage({ searchParams }: { searchParams: Promise<{ mode?: string; invite?: string; next?: string; locale?: string }> }) {
  const [params, jar, requestHeaders, user] = await Promise.all([searchParams, cookies(), headers(), getCurrentUser()]);
  const next = params.invite ? `/join/${encodeURIComponent(params.invite)}` : safeInternalPath(params.next, "/workspace/");
  if (user && !["reset", "verify", "forgot"].includes(params.mode ?? "")) redirect(next);
  const mode: AuthMode = ["signin", "signup", "verify", "forgot", "reset"].includes(params.mode ?? "") ? params.mode as AuthMode : "signin";
  const lang = params.locale ?? jar.get("pt_lang")?.value ?? "ru";
  const locale: AccountLocale = lang === "en" || lang === "kk" ? lang : "ru";
  const requestUrl = `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host") ?? "localhost"}/auth`;
  const previewAvailable = localMailPreviewAllowed(requestUrl, new Headers(requestHeaders));
  return <main id="main" className="account-page"><div className="account-container"><AuthForm mode={mode} locale={locale} next={next} previewAvailable={previewAvailable} /></div></main>;
}
