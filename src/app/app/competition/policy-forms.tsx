"use client";
import { useActionState } from "react";
import { createPolicyVersion, requestAiTransform, type ActionState } from "@/server/actions";
import { POLICY_ACTIONS, POLICY_DECISIONS } from "@/modules/policies/engine";

export function PolicyVersionForm({ profiles }: { profiles: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createPolicyVersion, null);
  return (
    <form action={action} className="mt-3 space-y-2 text-sm">
      <select name="profileId" className="select" aria-label="Profile">
        {profiles.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input name="version" className="input mono" placeholder="2026.27" required aria-label="Version" />
        <select name="status" className="select" defaultValue="needs_review" aria-label="Status">
          <option value="draft">draft</option>
          <option value="needs_review">needs review</option>
          <option value="active">active</option>
        </select>
      </div>
      <input name="effectiveFrom" type="date" className="input" aria-label="Effective from" />
      <textarea name="sourceUrls" className="textarea !min-h-12" placeholder="Official source URLs (whitespace separated)" aria-label="Source URLs" />
      <textarea name="changelog" className="textarea !min-h-12" placeholder="What changed and where it was verified" required aria-label="Changelog" />
      <details>
        <summary className="cursor-pointer text-xs text-text-3">Action matrix</summary>
        <div className="mt-2 grid gap-1">
          {POLICY_ACTIONS.map((a) => (
            <label key={a} className="flex items-center justify-between gap-2">
              <span className="mono text-xs">{a}</span>
              <select name={`matrix.${a}`} className="select !min-h-7 !w-40 text-xs" defaultValue="UNKNOWN">
                {POLICY_DECISIONS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </details>
      {state?.error ? <p role="alert" className="rounded-md bg-danger-bg px-2 py-1 text-xs text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="text-xs text-success">{state.message}</p> : null}
      <button className="btn btn-sm btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Record version"}
      </button>
    </form>
  );
}

export function PolicyDemo() {
  const [state, action, pending] = useActionState<ActionState, FormData>(requestAiTransform, null);
  return (
    <form action={action} className="mt-3 space-y-2 text-sm">
      <input type="hidden" name="entityType" value="iteration" />
      <input type="hidden" name="entityId" value="" />
      <select name="action" className="select !w-auto" defaultValue="rewrite_student_text" aria-label="Action">
        <option value="rewrite_student_text">rewrite_student_text</option>
        <option value="grammar_improve_student_text">grammar_improve_student_text</option>
        <option value="generate_portfolio_text">generate_portfolio_text</option>
        <option value="generate_reflection">generate_reflection</option>
        <option value="search_evidence">search_evidence</option>
      </select>
      <textarea name="text" className="textarea !min-h-14" defaultValue="At 32 mm the object occasionally became wedged between the rollers." aria-label="Sample text" />
      <button className="btn btn-sm" disabled={pending}>
        {pending ? "Evaluating…" : "Request transformation"}
      </button>
      {state?.error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-xs text-danger">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? <pre className="whitespace-pre-wrap rounded-md bg-surface-muted p-2 text-xs">{state.message}</pre> : null}
    </form>
  );
}
