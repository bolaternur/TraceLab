"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { surfaceTransition } from "./policy";

export function SpatialRouteSurface({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence initial={false} mode="wait">
      <motion.div
        key={routeKey}
        className="h-full min-h-0"
        initial={reduceMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
        transition={surfaceTransition(Boolean(reduceMotion))}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
