"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type ActionState } from "@/server/actions";

export function AuthForm({ mode, invite, next }: { mode: "signin" | "signup"; invite?: string; next?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(mode === "signup" ? signUp : signIn, null);
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-xl font-semibold">{mode === "signup" ? "Create your account" : "Sign in"}</h1>
      {invite ? <input type="hidden" name="invite" value={invite} /> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {mode === "signup" ? (
        <div>
          <label className="label" htmlFor="displayName">
            Display name
          </label>
          <input id="displayName" name="displayName" className="input" required maxLength={80} autoComplete="name" />
          <p className="hint mt-1">First name and initial is enough. We keep personal data minimal.</p>
        </div>
      ) : null}
      <div>
        <label className="label" htmlFor="email">
          Email
        </label>
        <input id="email" name="email" type="email" className="input" required autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" className="input" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        {mode === "signup" ? <p className="hint mt-1">At least 8 characters.</p> : null}
      </div>
      {state?.error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-text-2">
        {mode === "signup" ? (
          <>
            Already have an account? <Link className="text-blueprint" href={`/auth?mode=signin${invite ? `&invite=${invite}` : ""}`}>Sign in</Link>
          </>
        ) : (
          <>
            New here? <Link className="text-blueprint" href={`/auth?mode=signup${invite ? `&invite=${invite}` : ""}`}>Create account</Link>
          </>
        )}
      </p>
    </form>
  );
}
