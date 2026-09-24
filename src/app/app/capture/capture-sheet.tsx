"use client";

import { useEffect, useState } from "react";
import { SyncStatus } from "@/components/tracelab/sync-status";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { CaptureKindPicker } from "@/components/capture/capture-kind-picker";
import { CaptureFormFields } from "@/components/capture/capture-form-fields";
import {
  capturePrompt,
  isCaptureKind,
  type CaptureKind,
} from "@/components/capture/model";
import { useCaptureController, type CaptureSavedResult } from "@/components/capture/use-capture-controller";

interface Props {
  teamId: string;
  subsystems: Array<{ id: string; name: string }>;
  iterations: Array<{ id: string; title: string }>;
  tests: Array<{ id: string; title: string }>;
  initialKind?: string;
  initialIteration?: string;
  initialSubsystem?: string;
  variant?: "route" | "overlay";
  onSaved?: (result: CaptureSavedResult) => void;
  onRequestClose?: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export function CaptureSheet({
  teamId,
  subsystems,
  iterations,
  tests,
  initialKind,
  initialIteration,
  initialSubsystem,
  variant = "route",
  onSaved,
  onRequestClose,
  onBusyChange,
}: Props) {
  const [kind, setKind] = useState<CaptureKind>(isCaptureKind(initialKind) ? initialKind : "photo");
  const [expanded, setExpanded] = useState(false);
  const { online, pending, failed, busy, toast, preview, selectPhoto, fileRef, trySync, onSubmit } = useCaptureController({ teamId, kind, onSaved });
  const prompt = capturePrompt(kind);

  useEffect(() => onBusyChange?.(busy), [busy, onBusyChange]);

  return (
    <div className={variant === "overlay" ? "space-y-3" : "space-y-4"} data-capture-variant={variant}>
      <SyncStatus online={online} pendingCount={pending.length} failedCount={failed.length} onSync={trySync} />

      {failed.length ? (
        <div role="alert" className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
          <strong>{failed.length} capture{failed.length > 1 ? "s" : ""} could not sync.</strong> They remain on this device. {failed[0].error}
        </div>
      ) : null}

      {variant === "route" ? (
        <section>
          <div className="mb-3">
            <div className="trace-meta text-[10px] uppercase text-text-3">Quick capture</div>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">What happened?</h2>
            <p className="mt-1 text-sm text-text-2">Capture now. Enrich later. Known project context is attached automatically.</p>
          </div>
          <CaptureKindPicker value={kind} onChange={setKind} />
        </section>
      ) : (
        <CaptureKindPicker value={kind} onChange={setKind} compact />
      )}

      <form onSubmit={onSubmit} className={variant === "overlay" ? "overflow-hidden rounded-[22px] border border-border bg-surface" : "overflow-hidden rounded-[28px] border border-border bg-surface"}>
        <input type="hidden" name="kind" value={kind} />

        <header className={variant === "overlay" ? "border-b border-border bg-canvas px-4 py-4" : "border-b border-border bg-canvas px-4 py-5 sm:px-6"}>
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="trace-meta text-[10px] uppercase text-blueprint">{prompt.eyebrow}</div>
              <h3 className={variant === "overlay" ? "mt-1 text-lg font-semibold tracking-[-0.02em]" : "mt-1 text-xl font-semibold tracking-[-0.025em] sm:text-2xl"}>{prompt.title}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-text-3">{prompt.helper}</p>
            </div>
            {variant === "overlay" && onRequestClose ? (
              <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-text-3 hover:bg-black/[0.04] hover:text-ink" onClick={onRequestClose} aria-label="Close capture">
                <TraceIcon name="close" size={18} />
              </button>
            ) : null}
          </div>
        </header>

        <div className={variant === "overlay" ? "space-y-4 p-4" : "space-y-5 p-4 sm:p-6"}>
          <CaptureFormFields
            kind={kind}
            variant={variant}
            preview={preview}
            onPhotoSelected={selectPhoto}
            fileRef={fileRef}
            tests={tests}
            subsystems={subsystems}
            iterations={iterations}
            initialIteration={initialIteration}
            initialSubsystem={initialSubsystem}
            expanded={expanded}
            setExpanded={setExpanded}
          />

          <button className="trace-button trace-button-primary trace-button-expressive w-full text-base" disabled={busy}>
            <TraceIcon name="capture" size={19} />
            {busy ? "Saving on this device…" : "Save capture"}
          </button>

          {toast ? (
            <p role="status" className={`mechanical-snap rounded-xl px-3 py-2.5 text-sm ${toast.tone === "ok" ? "bg-success-bg text-success" : toast.tone === "warn" ? "bg-warning-bg text-warning" : "bg-danger-bg text-danger"}`}>
              {toast.text}
            </p>
          ) : null}
        </div>
      </form>

      {pending.length ? (
        <details className={variant === "overlay" ? "rounded-xl border border-border bg-canvas p-3 text-sm" : "trace-surface p-3 text-sm"}>
          <summary className="cursor-pointer list-none font-semibold">Local outbox · {pending.length}</summary>
          <ul className="mt-2 divide-y divide-border">
            {pending.map((item) => (
              <li key={item.clientId} className="flex min-h-12 items-center justify-between gap-3 py-2">
                <span><span className="font-medium">{item.fields.kind}</span><span className="trace-meta ml-2 text-[9px] uppercase text-text-3">{new Date(item.createdAt).toLocaleTimeString()}</span></span>
                <span className={`badge ${item.status === "failed" ? "badge-danger" : "badge-warning"}`}>{item.status}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
