"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CAPTURE_KINDS, type CaptureWorkspaceOptions } from "@/components/capture/model";
import { surfaceTransition } from "@/components/spatial-motion/policy";
import type { CaptureSavedResult } from "@/components/capture/use-capture-controller";
import type { CaptureOverlayAction, CaptureOverlayState } from "@/components/capture/state";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { CaptureOverlay } from "./capture-overlay";

interface CaptureLauncherProps {
  state: CaptureOverlayState;
  dispatch: (action: CaptureOverlayAction) => void;
  options: CaptureWorkspaceOptions;
  onSaved?: (result: CaptureSavedResult) => void;
}

export function CaptureLauncher({ state, dispatch, options, onSaved }: CaptureLauncherProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && state.open) dispatch({ type: "close" });
    }
    function onCaptureRequest() {
      if (options.canAuthorStudentContent) dispatch({ type: "open" });
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("tracelab:capture", onCaptureRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("tracelab:capture", onCaptureRequest);
    };
  }, [dispatch, options.canAuthorStudentContent, state.open]);

  return (
    <>
      {options.canAuthorStudentContent ? (
        <button
          type="button"
          className="capture-launcher-trigger workbench-chrome fixed bottom-5 left-1/2 z-40 hidden h-11 w-11 -translate-x-1/2 place-items-center rounded-full text-white shadow-[0_14px_34px_rgb(0_0_0_/_0.28)] md:grid"
          aria-label="Capture evidence"
          title="Capture evidence"
          aria-expanded={state.open}
          onClick={() => dispatch(state.open ? { type: "close" } : { type: "open" })}
        >
          <TraceIcon name="capture" size={20} />
        </button>
      ) : null}

      <AnimatePresence initial={false}>
        {options.canAuthorStudentContent && state.open && state.stage === "choose" ? (
          <motion.section
            className="capture-launcher-menu workbench-chrome fixed inset-x-3 bottom-[4.75rem] z-[70] rounded-[18px] p-2 text-white shadow-[0_22px_60px_rgb(0_0_0_/_0.35)] md:inset-x-auto md:bottom-[4.6rem] md:left-1/2 md:w-[340px] md:-translate-x-1/2"
            aria-label="Choose capture type"
            initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 5, scale: 0.99 }}
            transition={surfaceTransition(Boolean(reduceMotion))}
          >
            <div className="px-2 pb-2 pt-1">
              <div className="trace-meta text-[9px] uppercase text-white/42">Capture evidence</div>
              <div className="mt-0.5 text-sm font-semibold">What happened?</div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {CAPTURE_KINDS.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className="flex min-h-14 items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3 text-left hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6f8bff]"
                  onClick={() => dispatch({ type: "select-kind", kind: item.kind })}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-white/75"><TraceIcon name={item.icon} size={17} /></span>
                  <span className="min-w-0"><strong className="block text-xs">{item.label}</strong><span className="block truncate text-[10px] text-white/42">{item.hint || "student-authored"}</span></span>
                </button>
              ))}
            </div>
            <Link href="/app/capture" className="mt-2 flex min-h-10 items-center justify-center rounded-xl text-xs font-semibold text-white/62 hover:bg-white/[0.05] hover:text-white">Open full capture ↗</Link>
          </motion.section>
        ) : null}
      </AnimatePresence>

      {options.canAuthorStudentContent ? <CaptureOverlay state={state} dispatch={dispatch} options={options} onSaved={onSaved} /> : null}
    </>
  );
}
