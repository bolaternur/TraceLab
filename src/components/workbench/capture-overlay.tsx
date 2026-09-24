"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CaptureSheet } from "@/app/app/capture/capture-sheet";
import { panelTransition, surfaceTransition } from "@/components/spatial-motion/policy";
import type { CaptureSavedResult } from "@/components/capture/use-capture-controller";
import type { CaptureWorkspaceOptions } from "@/components/capture/model";
import type { CaptureOverlayAction, CaptureOverlayState } from "@/components/capture/state";

interface CaptureOverlayProps {
  state: CaptureOverlayState;
  options: CaptureWorkspaceOptions;
  dispatch: (action: CaptureOverlayAction) => void;
  onSaved?: (result: CaptureSavedResult) => void;
}

export function CaptureOverlay({ state, options, dispatch, onSaved }: CaptureOverlayProps) {
  const reduceMotion = useReducedMotion();
  const kind = state.open && state.stage === "compose" ? state.kind : null;

  return (
    <AnimatePresence initial={false}>
      {kind ? (
        <motion.div
          key="capture-overlay"
          className="capture-overlay-scrim fixed inset-0 z-[80] flex items-end justify-center bg-black/35 p-0 md:items-center md:justify-end md:p-5"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={surfaceTransition(Boolean(reduceMotion))}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) dispatch({ type: "close" });
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-label={`${kind} capture`}
            className="capture-overlay-panel max-h-[92dvh] w-full overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#f7f7f3] p-3 text-[#111315] shadow-[0_28px_90px_rgb(0_0_0_/_0.42)] md:max-h-[calc(100dvh-40px)] md:w-[min(520px,calc(100vw-90px))] md:rounded-[26px]"
            initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.99 }}
            transition={panelTransition(Boolean(reduceMotion))}
          >
            <CaptureSheet
              key={kind}
              variant="overlay"
              teamId={options.teamId}
              subsystems={options.subsystems}
              iterations={options.iterations}
              tests={options.tests}
              initialKind={kind}
              onRequestClose={() => dispatch({ type: "close" })}
              onBusyChange={(saving) => dispatch({ type: "set-saving", saving })}
              onSaved={onSaved}
            />
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
