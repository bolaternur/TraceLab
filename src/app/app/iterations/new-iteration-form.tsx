"use client";
// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import { useActionState } from "react";
import { createIteration, type ActionState } from "@/server/actions";

export function NewIterationForm({ subsystems }: { subsystems: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createIteration, null);
  return (
    <form action={action} className="mt-3 space-y-3">
      <label className="block">
        <span className="label"><UiText text="Title" /></span>
        <UiElement as="input" name="title" className="input" required maxLength={160} placeholder="Intake reliability — roller spacing" />
      </label>
      <label className="block">
        <span className="label"><UiText text="Subsystem" /></span>
        <select name="subsystemId" className="select" defaultValue="">
          <option value="">—</option>
          {subsystems.map((s) => (
            <option key={s.id} value={s.id}>
              <UiText text={s.name} />
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label"><UiText text="Problem or goal" /></span>
        <UiElement as="textarea" name="problemOrGoal" className="textarea" placeholder="Game piece occasionally jams between the rollers." />
      </label>
      <p className="hint"><UiText text="Similar past work will be surfaced as a suggestion — “we already tried this”." /></p>
      {state?.error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"><UiText text={state.error} /></p> : null}
      <button className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Opening…" : "Open iteration"}
      </button>
    </form>
  );
}
