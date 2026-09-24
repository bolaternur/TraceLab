export const SPATIAL_MOTION = {
  micro: 130,
  selection: 140,
  standard: 200,
  panel: 220,
  camera: 270,
  surface: 160,
  relationship: 300,
  ease: [0.2, 0, 0, 1] as const,
} as const;

export type SpatialMotionKey = keyof Pick<typeof SPATIAL_MOTION, "micro" | "selection" | "standard" | "panel" | "camera" | "surface" | "relationship">;

export function motionDuration(key: SpatialMotionKey, reducedMotion: boolean) {
  return reducedMotion ? 0 : SPATIAL_MOTION[key];
}

export function panelTransition(reducedMotion: boolean) {
  return {
    duration: motionDuration("panel", reducedMotion) / 1000,
    ease: SPATIAL_MOTION.ease,
  } as const;
}

export function surfaceTransition(reducedMotion: boolean) {
  return {
    duration: motionDuration("surface", reducedMotion) / 1000,
    ease: SPATIAL_MOTION.ease,
  } as const;
}
