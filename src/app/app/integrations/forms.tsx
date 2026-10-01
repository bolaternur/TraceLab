"use client";
// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import { useActionState } from "react";
import { connectSource, importCsv, type ActionState } from "@/server/actions";

export function ConnectForm({ provider, title, description, fields, oauthHref }: { provider: string; title: string; description: string; fields: Array<{ name: string; label: string; placeholder?: string; secret?: boolean }>; oauthHref?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(connectSource, null);
  return (
    <section className="card p-4 text-sm">
      <h3 className="font-semibold"><UiText text={title} /></h3>
      <p className="hint mt-1"><UiText text={description} /></p>
      {oauthHref ? (
        <a href={oauthHref} className="btn btn-sm btn-primary mt-2"><UiText text="Authorize with " /><UiText text={title} />
        </a>
      ) : null}
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="provider" value={provider} />
        <UiElement as="input" name="label" className="input !min-h-8 text-sm" placeholder="Label (e.g. team/orion-robot)" required aria-label="Label" />
        {fields.map((f) => (
          <UiElement as="input" key={f.name} name={f.name} type={f.secret ? "password" : "text"} className="input !min-h-8 text-sm" placeholder={f.placeholder ?? f.label} aria-label={f.label} autoComplete="off" />
        ))}
        <button className="btn btn-sm" disabled={pending}>
          <UiText text={pending ? "Connecting…" : "Connect"} />
        </button>
      </form>
      {state?.error ? <p role="alert" className="mt-2 rounded-md bg-danger-bg px-2 py-1 text-xs text-danger"><UiText text={state.error} /></p> : null}
      {state?.ok ? <p className="mono mt-2 break-all rounded-md bg-success-bg px-2 py-1 text-xs text-success"><UiText text={state.message} /></p> : null}
    </section>
  );
}

export function CsvImportForm({ subsystems }: { subsystems: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(importCsv, null);
  return (
    <form action={action} className="mt-3 space-y-2 text-sm">
      <UiElement as="textarea" name="csv" className="textarea mono !min-h-28 text-xs" placeholder="title,trials,successes,units,date" required aria-label="CSV content" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <UiElement as="input" name="titleCol" className="input !min-h-8" defaultValue="title" aria-label="Title column" placeholder="title column" required />
        <UiElement as="input" name="trialsCol" className="input !min-h-8" defaultValue="trials" aria-label="Trials column" placeholder="trials column" />
        <UiElement as="input" name="successesCol" className="input !min-h-8" defaultValue="successes" aria-label="Successes column" placeholder="successes column" />
        <UiElement as="input" name="valueCol" className="input !min-h-8" aria-label="Value column" placeholder="value column" />
        <UiElement as="input" name="unitsCol" className="input !min-h-8" defaultValue="units" aria-label="Units column" placeholder="units column" />
        <UiElement as="input" name="dateCol" className="input !min-h-8" defaultValue="date" aria-label="Date column" placeholder="date column" />
      </div>
      <UiElement as="select" name="subsystemId" className="select !min-h-8 !w-auto" defaultValue="" aria-label="Subsystem">
        <option value=""><UiText text="Subsystem…" /></option>
        {subsystems.map((s) => (
          <option key={s.id} value={s.id}>
            <UiText text={s.name} />
          </option>
        ))}
      </UiElement>
      <div className="flex gap-2">
        <button className="btn btn-sm" name="commit" value="no" disabled={pending}><UiText text="Preview " /></button>
        <button className="btn btn-sm btn-primary" name="commit" value="yes" disabled={pending}><UiText text="Import " /></button>
      </div>
      {state?.error ? <p role="alert" className="rounded-md bg-danger-bg px-2 py-1 text-xs text-danger"><UiText text={state.error} /></p> : null}
      {state?.ok ? <pre className="whitespace-pre-wrap rounded-md bg-surface-muted p-2 text-xs"><UiText text={state.message} /></pre> : null}
    </form>
  );
}
