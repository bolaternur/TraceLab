"use client";

import { useActionState, useRef, useState } from "react";
import { createTeam, type ActionState } from "@/server/actions";
import { TraceIcon } from "@/components/tracelab/trace-icon";

const PROGRAM_TO_PROFILE: Record<string, string> = { FTC: "ftc_2026_27", VEX: "vex_strict", ISEF: "isef_2027", FRC: "generic", OTHER: "generic" };
const DEFAULT_SUBSYSTEMS: Record<string, string> = { FTC: "Intake, Drivetrain, Lift, Autonomous, Vision", VEX: "Intake, Drivetrain, Lift, Autonomous", FRC: "Drivetrain, Intake, Shooter, Climber, Autonomous", ISEF: "Apparatus, Data collection, Analysis", OTHER: "Mechanical, Software, Electrical" };
const STEPS = ["Project", "Competition", "Workshop defaults", "Trust"] as const;

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export function OnboardingForm({ profiles, defaultLocale }: { profiles: Array<{ id: string; key: string; name: string; program: string; description: string }>; defaultLocale: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTeam, null);
  const [step, setStep] = useState(0);
  const [program, setProgram] = useState("FTC");
  const [orgMode, setOrgMode] = useState<"independent" | "organization">("independent");
  const [profileKey, setProfileKey] = useState(PROGRAM_TO_PROFILE.FTC);
  const formRef = useRef<HTMLFormElement>(null);
  const selected = profiles.find((p) => p.key === profileKey);
  const year = new Date().getFullYear();

  function goForward() {
    const current = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    if (!current) return;
    const controls = Array.from(current.querySelectorAll<FormControl>("input, select, textarea"));
    const invalid = controls.find((control) => !control.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return;
    }
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
  }

  return (
    <form ref={formRef} action={action} className="space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <p className="trace-meta text-[11px] uppercase text-text-3">Setup · {step + 1}/{STEPS.length}</p>
          <p className="mt-1 text-sm font-semibold">{STEPS[step]}</p>
        </div>
        <ol className="flex gap-1.5" aria-label="Setup progress">
          {STEPS.map((label, index) => (
            <li key={label}>
              <span className={`block h-1.5 rounded-full ${index <= step ? "w-8 bg-blueprint" : "w-4 bg-border-strong"}`} aria-label={`${label}${index === step ? ", current step" : ""}`} />
            </li>
          ))}
        </ol>
      </div>

      <section data-step="0" className={step === 0 ? "space-y-5" : "hidden"} aria-hidden={step !== 0}>
        <div>
          <p className="trace-meta text-[11px] uppercase text-blueprint">Project</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">What are you building with?</h2>
          <p className="mt-1 text-sm text-text-2">Name the team and project. Everything starts private and can work before you connect a source.</p>
        </div>

        <fieldset>
          <legend className="label">Team ownership</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(["independent", "organization"] as const).map((mode) => (
              <label key={mode} className={`evidence-card flex cursor-pointer items-start gap-3 p-4 text-sm ${orgMode === mode ? "border-blueprint bg-blueprint-bg" : ""}`}>
                <input type="radio" name="orgMode" value={mode} checked={orgMode === mode} onChange={() => setOrgMode(mode)} className="mt-1" />
                <span>
                  <span className="font-semibold">{mode === "independent" ? "Independent team" : "School / robotics club"}</span>
                  <span className="mt-0.5 block text-text-2">{mode === "independent" ? "Start with one private team. Attach an organization later." : "Create the organization now and add more teams or coaches later."}</span>
                </span>
              </label>
            ))}
          </div>
          {orgMode === "organization" ? (
            <div className="mt-3">
              <label className="label" htmlFor="orgName">Organization name</label>
              <input id="orgName" name="orgName" className="input" required maxLength={120} autoComplete="organization" />
            </div>
          ) : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="teamName">Team name</label>
            <input id="teamName" name="teamName" className="input" required maxLength={120} autoComplete="organization-title" />
          </div>
          <div>
            <label className="label" htmlFor="teamNumber">Team number <span className="text-text-3">(optional)</span></label>
            <input id="teamNumber" name="teamNumber" className="input mono" maxLength={20} />
          </div>
          <div>
            <label className="label" htmlFor="program">Program</label>
            <select
              id="program"
              name="program"
              className="select"
              value={program}
              onChange={(event) => {
                setProgram(event.target.value);
                setProfileKey(PROGRAM_TO_PROFILE[event.target.value] ?? "generic");
              }}
            >
              {["FTC", "VEX", "FRC", "ISEF", "OTHER"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="projectName">Project / robot name</label>
            <input id="projectName" name="projectName" className="input" required maxLength={120} placeholder="e.g. Orion" />
          </div>
        </div>
      </section>

      <section data-step="1" className={step === 1 ? "space-y-5" : "hidden"} aria-hidden={step !== 1}>
        <div>
          <p className="trace-meta text-[11px] uppercase text-blueprint">Competition</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Pin the rules to this season.</h2>
          <p className="mt-1 text-sm text-text-2">The policy profile controls AI, authorship and export behavior. You can review it later in Competition Mode.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="profileKey">Competition profile</label>
            <select id="profileKey" name="profileKey" className="select" value={profileKey} onChange={(event) => setProfileKey(event.target.value)}>
              {profiles.map((profile) => <option key={profile.key} value={profile.key}>{profile.name}</option>)}
            </select>
            {selected ? <p className="hint mt-2">{selected.description}</p> : null}
          </div>
          <div>
            <label className="label" htmlFor="seasonName">Season</label>
            <input id="seasonName" name="seasonName" className="input" defaultValue={`${year} Season`} required maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="seasonYear">Season year</label>
            <input id="seasonYear" name="seasonYear" type="number" className="input mono" defaultValue={year} min={2000} max={2100} required />
          </div>
        </div>
        <div className="rounded-[18px] border border-border-subtle bg-bg-subtle p-4 text-sm">
          <div className="flex gap-3">
            <TraceIcon name="policy" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Policy is explicit, never guessed.</p>
              <p className="mt-1 text-text-2">If a season rule is unknown or outdated, risky AI/export actions fail closed until the policy is reviewed.</p>
            </div>
          </div>
        </div>
      </section>

      <section data-step="2" className={step === 2 ? "space-y-5" : "hidden"} aria-hidden={step !== 2}>
        <div>
          <p className="trace-meta text-[11px] uppercase text-blueprint">Workshop defaults</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Set defaults once. Capture faster later.</h2>
          <p className="mt-1 text-sm text-text-2">These values help timestamps, labels and subsystem capture. They remain editable in Settings.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="timezone">Timezone</label>
            <input id="timezone" name="timezone" className="input" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone} required />
          </div>
          <div>
            <label className="label" htmlFor="locale">Default language</label>
            <select id="locale" name="locale" className="select" defaultValue={defaultLocale}>
              <option value="en">English</option>
              <option value="ru">Русский</option>
              <option value="kk">Қазақша</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="subsystems">Initial subsystems <span className="text-text-3">(comma separated)</span></label>
            <input id="subsystems" name="subsystems" className="input" key={program} defaultValue={DEFAULT_SUBSYSTEMS[program]} />
            <p className="hint mt-2">Keep this broad. You can change the taxonomy as the robot evolves.</p>
          </div>
        </div>
      </section>

      <section data-step="3" className={step === 3 ? "space-y-5" : "hidden"} aria-hidden={step !== 3}>
        <div>
          <p className="trace-meta text-[11px] uppercase text-blueprint">Trust</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">Private by default.</h2>
          <p className="mt-1 text-sm text-text-2">Create the workspace first. Then capture manually or connect sources when the team is ready.</p>
        </div>

        <div className="evidence-card overflow-hidden">
          {[
            ["reflection", "Student-authored reasoning stays student-authored", "Coaches and AI cannot silently rewrite the rationale students enter."],
            ["evidence", "Original source evidence is preserved", "Imported events and original capture history remain traceable."],
            ["offline", "Capture works before the network does", "Workshop evidence is saved on-device first and synced when connectivity returns."],
            ["integration", "Connect sources after creation", "GitHub and other integrations are optional; the first useful capture does not depend on them."],
          ].map(([icon, title, body]) => (
            <div key={title} className="flex gap-3 border-b border-border-subtle p-4 last:border-b-0">
              <TraceIcon name={icon as "reflection" | "evidence" | "offline" | "integration"} className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-0.5 text-sm text-text-2">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[18px] border border-teal/40 bg-teal-bg p-4 text-sm">
          <strong>Student-Owned Mode is on by default.</strong>
          <p className="mt-1 text-text-2">Generative assistance is available only where the selected competition policy explicitly permits it.</p>
        </div>
      </section>

      {state?.error ? <p role="alert" className="rounded-[18px] bg-danger-bg px-4 py-3 text-sm text-danger">{state.error}</p> : null}

      <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-5">
        <button type="button" className="btn" onClick={() => setStep((value) => Math.max(value - 1, 0))} disabled={step === 0 || pending}>Back</button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={goForward}>Continue</button>
        ) : (
          <button className="btn btn-primary btn-lg" disabled={pending}>{pending ? "Creating…" : "Create private workspace"}</button>
        )}
      </div>
    </form>
  );
}
