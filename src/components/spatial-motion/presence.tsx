"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { panelTransition, surfaceTransition } from "./policy";

export function SpatialFadeSwap({ motionKey, children, className }: { motionKey: string; children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={motionKey}
        className={className}
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -3 }}
        transition={surfaceTransition(Boolean(reduceMotion))}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function SpatialBottomSheet({
  open,
  onDismiss,
  label,
  children,
  panelClassName = "",
}: {
  open: boolean;
  onDismiss: () => void;
  label: string;
  children: ReactNode;
  panelClassName?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end bg-black/25 p-2 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={label}
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={surfaceTransition(Boolean(reduceMotion))}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onDismiss();
          }}
        >
          <motion.div
            className={`w-full rounded-[22px] border border-border bg-surface shadow-[0_-18px_50px_rgba(17,19,21,.18)] ${panelClassName}`}
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
            transition={panelTransition(Boolean(reduceMotion))}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
