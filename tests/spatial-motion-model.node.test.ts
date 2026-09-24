import test from "node:test";
import assert from "node:assert/strict";
import { SPATIAL_MOTION, motionDuration, panelTransition, surfaceTransition } from "../src/components/spatial-motion/policy.ts";

test("spatial motion policy stays inside TraceLab timing bands", () => {
  assert.ok(SPATIAL_MOTION.micro >= 100 && SPATIAL_MOTION.micro <= 160);
  assert.ok(SPATIAL_MOTION.selection >= 120 && SPATIAL_MOTION.selection <= 160);
  assert.ok(SPATIAL_MOTION.panel >= 200 && SPATIAL_MOTION.panel <= 240);
  assert.ok(SPATIAL_MOTION.camera >= 240 && SPATIAL_MOTION.camera <= 300);
  assert.ok(SPATIAL_MOTION.surface <= 180);
});

test("reduced motion collapses spatial durations to zero", () => {
  assert.equal(motionDuration("panel", true), 0);
  assert.equal(motionDuration("camera", true), 0);
  assert.equal(panelTransition(true).duration, 0);
  assert.equal(surfaceTransition(true).duration, 0);
});

test("panel and surface transitions share the restrained TraceLab easing", () => {
  assert.deepEqual(panelTransition(false).ease, SPATIAL_MOTION.ease);
  assert.deepEqual(surfaceTransition(false).ease, SPATIAL_MOTION.ease);
  assert.equal(panelTransition(false).duration * 1000, SPATIAL_MOTION.panel);
  assert.equal(surfaceTransition(false).duration * 1000, SPATIAL_MOTION.surface);
});
