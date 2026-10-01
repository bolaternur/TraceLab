"use client";
// locale-wired
import { UiText } from "@/components/locale-provider";
import { useActionState } from "react";
import { createExport, type ActionState } from "@/server/actions";

export function ExportButton({ type, label, allowGenerated }: { type: string; label: string; allowGenerated?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createExport, null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="type" value={type} />
      {allowGenerated ? (
        <label className="flex items-center gap-2 text-xs text-text-2">
          <input type="checkbox" name="includeGenerated" /><UiText text="Include disclosed AI-generated notes (policy-gated) " /></label>
      ) : null}
      <button className="btn btn-sm" disabled={pending}>
        <UiText text={pending ? "Building…" : label} />
      </button>
      {state?.error ? <p role="alert" className="rounded-md bg-danger-bg px-2 py-1 text-xs text-danger"><UiText text={state.error} /></p> : null}
      {state?.ok ? (
        <p role="status" className="text-xs text-success">
          <UiText text={state.message} />{" "}
          <a className="underline" href={`/api/exports/${state.id}`}><UiText text="Download " /></a>
        </p>
      ) : null}
    </form>
  );
}
