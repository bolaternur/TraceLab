"use client";
import { useActionState } from "react";
import { connectSource, importCsv, type ActionState } from "@/server/actions";

export function ConnectForm({ provider, title, description, fields, oauthHref }: { provider: string; title: string; description: string; fields: Array<{ name: string; label: string; placeholder?: string; secret?: boolean }>; oauthHref?: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(connectSource, null);
  return (
    <section className="card p-4 text-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="hint mt-1">{description}</p>
      {oauthHref ? (
        <a href={oauthHref} className="btn btn-sm btn-primary mt-2">
          Authorize with {title}
        </a>
      ) : null}
      <form action={action} className="mt-2 space-y-2">
        <input type="hidden" name="provider" value={provider} />
        <input name="label" className="input !min-h-8 text-sm" placeholder="Label (e.g. team/orion-robot)" required aria-label="Label" />
        {fields.map((f) => (
          <input key={f.name} name={f.name} type={f.secret ? "password" : "text"} className="input !min-h-8 text-sm" placeholder={f.placeholder ?? f.label} aria-label={f.label} autoComplete="off" />
        ))}
        <button className="btn btn-sm" disabled={pending}>
          {pending ? "Connecting…" : "Connect"}
        </button>
      </form>
      {state?.error ? <p role="alert" className="mt-2 rounded-md bg-danger-bg px-2 py-1 text-xs text-danger">{state.error}</p> : null}
      {state?.ok ? <p className="mono mt-2 break-all rounded-md bg-success-bg px-2 py-1 text-xs text-success">{state.message}</p> : null}
    </section>
  );
}

export function CsvImportForm({ subsystems }: { subsystems: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(importCsv, null);
  return (
    <form action={action} className="mt-3 space-y-2 text-sm">
      <textarea name="csv" className="textarea mono !min-h-28 text-xs" placeholder={"title,trials,successes,units,date\nIntake pickup 36 mm,20,17,,2026-09-01"} required aria-label="CSV content" />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <input name="titleCol" className="input !min-h-8" defaultValue="title" aria-label="Title column" placeholder="title column" required />
        <input name="trialsCol" className="input !min-h-8" defaultValue="trials" aria-label="Trials column" placeholder="trials column" />
        <input name="successesCol" className="input !min-h-8" defaultValue="successes" aria-label="Successes column" placeholder="successes column" />
        <input name="valueCol" className="input !min-h-8" aria-label="Value column" placeholder="value column" />
        <input name="unitsCol" className="input !min-h-8" defaultValue="units" aria-label="Units column" placeholder="units column" />
        <input name="dateCol" className="input !min-h-8" defaultValue="date" aria-label="Date column" placeholder="date column" />
      </div>
      <select name="subsystemId" className="select !min-h-8 !w-auto" defaultValue="" aria-label="Subsystem">
        <option value="">Subsystem…</option>
        {subsystems.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <button className="btn btn-sm" name="commit" value="no" disabled={pending}>
          Preview
        </button>
        <button className="btn btn-sm btn-primary" name="commit" value="yes" disabled={pending}>
          Import
        </button>
      </div>
      {state?.error ? <p role="alert" className="rounded-md bg-danger-bg px-2 py-1 text-xs text-danger">{state.error}</p> : null}
      {state?.ok ? <pre className="whitespace-pre-wrap rounded-md bg-surface-muted p-2 text-xs">{state.message}</pre> : null}
    </form>
  );
}
