"use client";
// locale-wired
import { UiText, UiElement } from "@/components/locale-provider";
import { useActionState, useState } from "react";
import Link from "next/link";
import { askHistory, type ActionState } from "@/server/actions";
import { TraceIcon } from "@/components/tracelab/trace-icon";


export function AskForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(askHistory, null);
  const [q, setQ] = useState("");
  const body = state?.message ?? "";
  const parts = body.split(/(\[(?:test|decision|annotation|iteration):[0-9a-f-]{36}\])/g);

  return (
    <section className="overflow-hidden rounded-[28px] border border-border-subtle bg-surface shadow-[0_18px_54px_rgba(17,19,21,0.06)]">
      <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2">
          <TraceIcon name="search" size={18} className="text-blueprint" />
          <h2 className="text-base font-semibold text-ink"><UiText text="Search project memory" /></h2>
        </div>
        <p className="mt-1 text-xs leading-5 text-text-3"><UiText text="Evidence citations stay attached so every useful answer has a path back to the original test, decision, iteration, or rationale." /></p>
      </div>

      <div className="bg-canvas px-4 py-4 sm:px-5 sm:py-5">
        <form action={action} className="rounded-[22px] border border-border-default bg-surface p-2 focus-within:border-blueprint/50 focus-within:ring-2 focus-within:ring-blueprint/10">
          <label htmlFor="memory-question" className="sr-only"><UiText text="Question about project history" /></label>
          <UiElement as="textarea"
            id="memory-question"
            name="question"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-[92px] w-full resize-none border-0 bg-transparent px-2 py-2 text-[16px] leading-6 text-ink outline-none placeholder:text-text-3 focus-visible:ring-2 focus-visible:ring-blueprint/45"
            placeholder="Why did we choose this design?"
            required
            minLength={3}
            maxLength={500}
          />
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-2">
            <span className="px-2 text-[11px] text-text-3"><UiText text="Searches your team's evidence first" /></span>
            <button className="trace-button trace-button-primary min-h-10 rounded-full px-4" disabled={pending}>
              <UiText text={pending ? "Searching…" : "Search memory"} />
              {!pending ? <span aria-hidden>→</span> : null}
            </button>
          </div>
        </form>


        {state?.error ? <p role="alert" className="mt-4 rounded-[14px] bg-danger-bg px-3 py-2 text-sm text-danger"><UiText text={state.error} /></p> : null}
        {state?.ok && body ? (
          <div className="mt-4 rounded-[18px] border border-border-subtle bg-surface p-4 text-sm leading-6 text-ink" aria-live="polite">
            <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-text-3">
              <TraceIcon name="evidence" size={14} /><UiText text="Answer with project evidence " /></div>
            <div className="whitespace-pre-wrap">
              {parts.map((part, index) => {
                const match = part.match(/^\[(test|decision|annotation|iteration):([0-9a-f-]{36})\]$/);
                if (!match) return <span key={index}><UiText text={part} /></span>;
                const href = match[1] === "test" ? `/app/tests/${match[2]}` : match[1] === "decision" ? `/app/decisions/${match[2]}` : match[1] === "iteration" ? `/app/iterations/${match[2]}` : `/app/search?q=${match[2].slice(0, 8)}`;
                return (
                  <Link key={index} href={href} className="mx-0.5 inline-flex rounded-full bg-blueprint-bg px-2 py-0.5 text-[11px] font-medium text-blueprint hover:underline">
                    {match[1]} ↗
                  </Link>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
