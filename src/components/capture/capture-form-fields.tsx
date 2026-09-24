"use client";

import Link from "next/link";
import type { RefObject } from "react";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import type { CaptureKind } from "./model";

interface CaptureFormFieldsProps {
  kind: CaptureKind;
  variant: "route" | "overlay";
  preview: string | null;
  onPhotoSelected: (file: File | null) => void;
  fileRef: RefObject<HTMLInputElement | null>;
  tests: Array<{ id: string; title: string }>;
  subsystems: Array<{ id: string; name: string }>;
  iterations: Array<{ id: string; title: string }>;
  initialIteration?: string;
  initialSubsystem?: string;
  expanded: boolean;
  setExpanded: (value: boolean | ((current: boolean) => boolean)) => void;
}

export function CaptureFormFields({
  kind,
  variant,
  preview,
  onPhotoSelected,
  fileRef,
  tests,
  subsystems,
  iterations,
  initialIteration,
  initialSubsystem,
  expanded,
  setExpanded,
}: CaptureFormFieldsProps) {
  const fullCaptureHref = `/app/capture?kind=${kind}${initialIteration ? `&iteration=${encodeURIComponent(initialIteration)}` : ""}${initialSubsystem ? `&subsystem=${encodeURIComponent(initialSubsystem)}` : ""}`;

  return (
    <>
      {kind === "photo" ? (
        <>
          <label className={`group relative grid cursor-pointer place-items-center overflow-hidden rounded-[20px] border border-dashed border-border-strong bg-canvas text-center transition-colors hover:border-blueprint ${variant === "overlay" ? "min-h-40" : "min-h-48"} ${preview ? "p-0" : "p-6"}`}>
            <input
              ref={fileRef}
              type="file"
              name="photo"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                onPhotoSelected(event.target.files?.[0] ?? null);
              }}
            />
            {preview ? (
              <>
                <img src={preview} alt="Selected evidence preview" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-x-3 bottom-3 rounded-xl bg-[#111315]/82 px-3 py-2 text-xs font-semibold text-white">Tap to replace photo</span>
              </>
            ) : (
              <div>
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-[18px] bg-blueprint-bg text-blueprint"><TraceIcon name="photo" size={22} /></span>
                <div className="mt-3 text-sm font-semibold">Take or choose a photo</div>
                <div className="mt-1 text-xs text-text-3">JPEG, PNG or WebP · EXIF/GPS stripped before upload</div>
              </div>
            )}
          </label>
          <CaptureField name="caption" label="What changed? (optional now)" placeholder="New roller geometry after the first pickup test" />
        </>
      ) : null}

      {kind === "problem" ? (
        <>
          <CaptureField name="body" label="What did you observe?" textarea required placeholder="Belt starts slipping after about 10 minutes of driving." />
          <label className="block max-w-sm">
            <span className="label">Severity</span>
            <select name="severity" className="select" defaultValue="medium">
              <option value="low">Low — can continue</option>
              <option value="medium">Medium — affects performance</option>
              <option value="high">High — blocks testing</option>
            </select>
          </label>
        </>
      ) : null}

      {kind === "test" ? (
        <>
          <CaptureField name="title" label="What were you testing?" required placeholder="Intake pickup at 36 mm roller spacing" />
          <CaptureField name="target" label="Target / revision (optional)" placeholder="Prototype B · CAD rev 23 · commit a1b2c3d" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[18px] bg-canvas p-3">
              <div className="trace-meta mb-2 text-[9px] uppercase text-text-3">Ratio result</div>
              <div className="grid grid-cols-2 gap-2">
                <CaptureField name="successes" label="Successes" type="number" min={0} />
                <CaptureField name="trials" label="Trials" type="number" min={0} />
              </div>
            </div>
            <div className="rounded-[18px] bg-canvas p-3">
              <div className="trace-meta mb-2 text-[9px] uppercase text-text-3">Measured result</div>
              <div className="grid grid-cols-2 gap-2">
                <CaptureField name="value" label="Value" placeholder="1.8" />
                <CaptureField name="units" label="Units" placeholder="s, cm, %" />
              </div>
            </div>
          </div>
          <label className="block max-w-sm">
            <span className="label">Outcome</span>
            <select name="outcome" className="select" defaultValue="inconclusive">
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="inconclusive">Inconclusive</option>
              <option value="qualitative">Qualitative</option>
            </select>
          </label>
          {variant === "route" ? (
            <>
              <button type="button" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blueprint" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
                <span aria-hidden>{expanded ? "−" : "+"}</span>{expanded ? "Hide" : "Add"} experimental detail
              </button>
              {expanded ? (
                <div className="grid gap-3 rounded-[18px] border border-border bg-canvas p-4 sm:grid-cols-2">
                  <CaptureField name="question" label="Question" textarea />
                  <CaptureField name="hypothesis" label="Hypothesis" textarea />
                  <CaptureField name="procedure" label="Procedure" textarea />
                  <CaptureField name="observations" label="Observations" textarea />
                  <CaptureField name="metricName" label="Metric" placeholder="success rate" />
                  <CaptureField name="passCriteria" label="Pass criterion" placeholder=">= 16 / 20" />
                </div>
              ) : (
                <CaptureField name="body" label="Quick observation (optional)" textarea placeholder="The ball stopped wedging after the second geometry change." />
              )}
            </>
          ) : (
            <>
              <CaptureField name="body" label="Quick observation (optional)" textarea placeholder="The result you do not want to forget." />
              <FullCaptureLink href={fullCaptureHref} label="Open full capture for procedure, hypothesis and pass criteria" />
            </>
          )}
        </>
      ) : null}

      {kind === "decision" ? (
        <>
          <CaptureField name="title" label="What did you decide?" required placeholder="Keep 36 mm roller spacing" />
          <div className="rounded-[20px] border border-decision/25 bg-[var(--decision-violet-soft)] p-4 sm:p-5">
            <div className="flex items-center gap-2 text-decision">
              <TraceIcon name="decision" size={18} />
              <span className="trace-meta text-[9px] uppercase">Student-authored rationale</span>
            </div>
            <CaptureField name="rationale" label="Why did you choose this?" textarea required placeholder="36 mm scored 17/20 vs 11/20, and wedging disappeared across repeated runs." />
            <p className="hint mt-2">AI does not write or silently modify this field.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Decision state</span>
              <select name="disposition" className="select" defaultValue="keep">
                {["keep", "revert", "iterate", "defer", "reject", "unknown"].map((disposition) => <option key={disposition}>{disposition}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="label">Supporting test (optional)</span>
              <select name="testId" className="select" defaultValue="">
                <option value="">—</option>
                {tests.map((test) => <option key={test.id} value={test.id}>{test.title}</option>)}
              </select>
            </label>
          </div>
          {variant === "route" ? (
            <>
              <CaptureField name="alternatives" label="Alternatives considered (optional)" textarea />
              <CaptureField name="nextStep" label="Next step (optional)" />
            </>
          ) : <FullCaptureLink href={fullCaptureHref} label="Open full capture for alternatives and next step" />}
        </>
      ) : null}

      {kind === "reflection" ? (
        <>
          <CaptureField name="learned" label="What did you learn?" textarea required />
          {variant === "route" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <CaptureField name="failed" label="What failed?" textarea />
              <CaptureField name="change" label="What will you change next?" textarea />
            </div>
          ) : <CaptureField name="change" label="What will you change next? (optional)" textarea />}
          <div className="rounded-xl bg-canvas px-3 py-2 text-xs text-text-3">Student-authored · AI did not generate or rewrite this reflection.</div>
        </>
      ) : null}

      <details className="rounded-[18px] border border-border bg-canvas p-3" open={Boolean(initialSubsystem || initialIteration)}>
        <summary className="cursor-pointer list-none text-sm font-semibold">
          <span className="inline-flex min-h-8 items-center gap-2"><span aria-hidden>＋</span> Link project context <span className="font-normal text-text-3">(optional now)</span></span>
        </summary>
        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Subsystem</span>
            <select name="subsystemId" className="select" defaultValue={initialSubsystem ?? ""}>
              <option value="">—</option>
              {subsystems.map((subsystem) => <option key={subsystem.id} value={subsystem.id}>{subsystem.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Iteration</span>
            <select name="iterationId" className="select" defaultValue={initialIteration ?? ""}>
              <option value="">—</option>
              {iterations.map((iteration) => <option key={iteration.id} value={iteration.id}>{iteration.title}</option>)}
            </select>
          </label>
        </div>
      </details>
    </>
  );
}

function FullCaptureLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold text-blueprint">
      Open full capture <span className="font-normal text-text-3">· {label}</span><span aria-hidden>↗</span>
    </Link>
  );
}

function CaptureField({ name, label, textarea, type = "text", ...rest }: { name: string; label: string; textarea?: boolean; type?: string } & React.InputHTMLAttributes<HTMLInputElement> & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {textarea
        ? <textarea name={name} className="textarea" {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)} />
        : <input name={name} type={type} className={`input ${type === "number" ? "mono" : ""}`} {...(rest as React.InputHTMLAttributes<HTMLInputElement>)} />}
    </label>
  );
}
