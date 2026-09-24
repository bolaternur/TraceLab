"use client";
import { useActionState } from "react";
import { joinTeam, type ActionState } from "@/server/actions";

export function JoinForm({ code }: { code: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(joinTeam, null);
  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="code" value={code} />
      {state?.error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{state.error}</p> : null}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Joining…" : "Join team"}
      </button>
    </form>
  );
}
