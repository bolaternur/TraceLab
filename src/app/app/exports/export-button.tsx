"use client";
import { useActionState } from "react";
import { createExport, type ActionState } from "@/server/actions";

export function ExportButton({ type, label, allowGenerated }: { type: string; label: string; allowGenerated?: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createExport, null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <input type="hidden" name="type" value={type} />
      {allowGenerated ? (
        <label className="flex items-center gap-2 text-xs text-text-2">
          <input type="checkbox" name="includeGenerated" /> Include disclosed AI-generated notes (policy-gated)
        </label>
      ) : null}
      <button className="btn btn-sm" disabled={pending}>
        {pending ? "Building…" : label}
      </button>
      {state?.error ? <p role="alert" className="rounded-md bg-danger-bg px-2 py-1 text-xs text-danger">{state.error}</p> : null}
      {state?.ok ? (
        <p role="status" className="text-xs text-success">
          {state.message}{" "}
          <a className="underline" href={`/api/exports/${state.id}`}>
            Download
          </a>
        </p>
      ) : null}
    </form>
  );
}
