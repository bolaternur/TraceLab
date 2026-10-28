"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { accountCopy, type AccountLocale } from "./account-copy";

export type AuthMode = "signin" | "signup" | "verify" | "forgot" | "reset";
type Message = { id: string; subject: string; actionUrl: string };
export function AuthForm({ mode: initialMode, locale: initialLocale, next, previewAvailable }: { mode: AuthMode; locale: AccountLocale; next: string; previewAvailable: boolean }) {
  const [mode, setMode] = useState(initialMode);
  const [locale, setLocale] = useState(initialLocale);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState("");
  const [continueUrl, setContinueUrl] = useState("");
  const [fields, setFields] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [mailPending, setMailPending] = useState(false);
  const busy = useRef(false);
  const copy = accountCopy[locale];

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const secret = fragment.get("token");
    // Fragment secrets cannot be included in server-rendered props. Read once
    // after hydration, then remove them from the browser's address bar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (secret) { setToken(secret); window.history.replaceState(null, "", window.location.pathname + window.location.search); }
    let saved = new URLSearchParams(window.location.search).get("locale");
    try { saved ||= localStorage.getItem("tracelab-locale"); } catch {}
    if (saved === "ru" || saved === "en" || saved === "kk") setLocale(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `pt_lang=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    try { localStorage.setItem("tracelab-locale", locale); } catch {}
    const url = new URL(window.location.href); url.searchParams.set("locale", locale); window.history.replaceState(null, "", url);
  }, [locale]);
  function changeLocale(value: AccountLocale) { setLocale(value); }
  function navigate(destination: string) {
    // The workspace is an HTML rewrite. Reload it after identity changes so its
    // server connector obtains the new cookie-backed session immediately.
    window.location.assign(new URL(destination, window.location.origin).href);
  }
  function changeMode(value: AuthMode) {
    setMode(value); setResult(""); setFields([]);
    const url = new URL(window.location.href); url.searchParams.set("mode", value); window.history.replaceState(null, "", url);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true; setPending(true); setResult(""); setFields([]);
    const action = mode === "verify" ? (token ? "verify" : "resend") : mode;
    try {
      const response = await fetch(`/api/account/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, displayName, password, token, locale, next }) });
      const data = await response.json() as { ok?: boolean; code?: string; next?: string; fields?: string[] };
      if (!data.ok) { setResult(data.code ?? "service_unavailable"); setFields(data.fields ?? []); return; }
      if (action === "signin" && data.next?.startsWith("/") && !data.next.startsWith("//")) { navigate(data.next); return; }
      setResult(data.code ?? "email_requested");
      if (action === "verify" && data.next?.startsWith("/auth?")) setContinueUrl(data.next);
      if (action === "signup") { setMode("verify"); setPassword(""); }
      if (action === "reset") { setPassword(""); setToken(""); setMode("signin"); }
      if (action === "verify") setToken("");
    } catch { setResult("network"); }
    finally { busy.current = false; setPending(false); }
  }
  async function loadMail() {
    setMailPending(true);
    try { const response = await fetch("/api/account/mail-preview", { cache: "no-store" }); if (!response.ok) throw new Error(); const data = await response.json() as { messages: Message[] }; setMessages(data.messages); }
    catch { setResult("service_unavailable"); }
    finally { setMailPending(false); }
  }
  const success = ["email_requested", "email_verified", "password_reset"].includes(result);
  const statusText = result === "email_requested" ? copy.requested : result === "email_verified" ? copy.verified : result === "password_reset" ? copy.passwordReset : copy[result as keyof typeof copy] ?? copy.service_unavailable;
  const intro = mode === "signup" ? copy.signupIntro : mode === "verify" ? copy.verifyIntro : mode === "forgot" ? copy.forgotIntro : mode === "reset" ? copy.resetIntro : copy.intro;
  const needsPassword = ["signin", "signup", "reset"].includes(mode);
  const emailVisible = mode !== "reset" && !(mode === "verify" && (token || result === "email_verified"));
  const submitText = mode === "signup" ? copy.signup : mode === "signin" ? copy.signin : mode === "reset" ? copy.savePassword : mode === "verify" && token ? copy.confirm : copy.request;
  return <>
    <header className="account-header"><Link className="account-brand" href="/" aria-label={copy.home}><Image src="/_presentation/assets/icon.svg" width={24} height={24} alt="" unoptimized />TraceLab</Link><div className="account-languages" role="group" aria-label={copy.language}>{(["ru", "en", "kk"] as const).map(value => <button type="button" key={value} aria-pressed={locale === value} aria-label={{ ru: "Русский", en: "English", kk: "Қазақша" }[value]} onClick={() => changeLocale(value)}>{value.toUpperCase()}</button>)}</div></header>
    <section className="account-card" aria-labelledby="account-title">
      <h1 id="account-title">{copy[mode]}</h1><p className="account-intro">{intro}</p>
      <form onSubmit={submit} aria-busy={pending}>
        {mode === "signup" ? <div className="account-field"><label htmlFor="displayName">{copy.name}</label><input id="displayName" name="displayName" autoComplete="name" required maxLength={80} value={displayName} onChange={event => setDisplayName(event.target.value)} aria-invalid={fields.includes("displayName")} /><p>{copy.nameHint}</p></div> : null}
        {emailVisible ? <div className="account-field"><label htmlFor="email">{copy.email}</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} aria-invalid={fields.includes("email")} /></div> : null}
        {needsPassword ? <div className="account-field"><label htmlFor="password">{mode === "reset" ? copy.newPassword : copy.password}</label><div className="account-password"><input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signin" ? 1 : 12} maxLength={mode === "signin" ? 200 : 128} required value={password} onChange={event => setPassword(event.target.value)} aria-invalid={fields.includes("password")} /><button type="button" aria-controls="password" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? copy.hide : copy.show}</button></div>{mode !== "signin" ? <p>{copy.passwordHint}</p> : null}</div> : null}
        {result ? <p className={`account-message ${success ? "is-success" : "is-error"}`} role={success ? "status" : "alert"}>{statusText}</p> : null}
        {mode === "reset" && !token ? <p className="account-message is-error" role="alert">{copy.invalid_token} <button type="button" onClick={() => changeMode("forgot")}>{copy.request}</button></p> : null}
        {result === "email_verified" ? <button className="account-primary" type="button" onClick={() => continueUrl ? navigate(`${continueUrl}&locale=${locale}`) : changeMode("signin")}>{copy.continue}</button> : <button className="account-primary" type="submit" disabled={pending || (mode === "reset" && !token)}>{pending ? copy.working : submitText}</button>}
        {mode === "signin" ? <div className="account-support"><button type="button" onClick={() => changeMode("forgot")}>{copy.forgotLink}</button><button type="button" onClick={() => changeMode("verify")}>{copy.resend}</button></div> : null}
        <div className="account-switch">{mode === "signin" || mode === "signup" ? <>{mode === "signup" ? copy.already : copy.newHere} <button type="button" onClick={() => changeMode(mode === "signup" ? "signin" : "signup")}>{mode === "signup" ? copy.signin : copy.signup}</button></> : <button type="button" onClick={() => changeMode("signin")}>{copy.back}</button>}</div>
      </form>
    </section>
    <p className="account-free">{copy.free}</p>
    {previewAvailable ? <aside className="account-mail"><h2>{copy.localMail}</h2><p>{copy.localNote}</p><button type="button" disabled={mailPending} onClick={loadMail}>{mailPending ? copy.working : copy.loadMail}</button>{messages ? <ul>{messages.length ? messages.map(message => <li key={message.id}><strong>{message.subject}</strong><a href={message.actionUrl}>{copy.openMail}</a></li>) : <li>{copy.noMail}</li>}</ul> : null}</aside> : null}
    <footer className="account-footer"><a href="/demo/">{copy.demo}</a><a href="/privacy-policy/">{copy.privacy}</a></footer>
  </>;
}
