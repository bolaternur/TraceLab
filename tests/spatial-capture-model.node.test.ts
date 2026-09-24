import test from "node:test";
import assert from "node:assert/strict";
import {
  CAPTURE_KINDS,
  captureDestination,
  capturePrompt,
  captureSyncState,
  validateCaptureDraft,
} from "../src/components/capture/model.ts";
import {
  initialCaptureOverlayState,
  reduceCaptureOverlayState,
} from "../src/components/capture/state.ts";

test("capture model keeps the five existing evidence kinds and their engineering prompts", () => {
  assert.deepEqual(CAPTURE_KINDS.map((item) => item.kind), ["photo", "problem", "test", "decision", "reflection"]);
  assert.equal(capturePrompt("photo").title, "What changed in this photo?");
  assert.equal(capturePrompt("decision").eyebrow, "Engineering decision");
  assert.match(capturePrompt("reflection").helper, /does not generate or rewrite/i);
});

test("capture validation preserves mandatory evidence rules without inventing new server requirements", () => {
  assert.deepEqual(validateCaptureDraft("photo", {}, false), { ok: false, message: "Choose or take a photo first." });
  assert.deepEqual(validateCaptureDraft("photo", {}, true), { ok: true });
  assert.deepEqual(validateCaptureDraft("decision", { title: "Keep rev B" }, false), { ok: false, message: "A decision needs your reason (why)." });
  assert.deepEqual(validateCaptureDraft("decision", { rationale: "17/20 was repeatable." }, false), { ok: true });
  assert.deepEqual(validateCaptureDraft("problem", { body: "Belt slips hot." }, false), { ok: true });
});

test("capture kinds map to the workboard that should structurally update after save", () => {
  assert.equal(captureDestination("photo"), "recent-evidence");
  assert.equal(captureDestination("problem"), "recent-evidence");
  assert.equal(captureDestination("reflection"), "recent-evidence");
  assert.equal(captureDestination("test"), "test-bench");
  assert.equal(captureDestination("decision"), "decision-trail");
});

test("capture overlay reducer keeps chooser composer and saving states explicit", () => {
  const chooser = reduceCaptureOverlayState(initialCaptureOverlayState, { type: "open" });
  assert.equal(chooser.open, true);
  assert.equal(chooser.stage, "choose");
  assert.equal(chooser.kind, null);

  const composer = reduceCaptureOverlayState(chooser, { type: "select-kind", kind: "test" });
  assert.equal(composer.stage, "compose");
  assert.equal(composer.kind, "test");

  const saving = reduceCaptureOverlayState(composer, { type: "set-saving", saving: true });
  assert.equal(saving.saving, true);
  const blockedClose = reduceCaptureOverlayState(saving, { type: "close" });
  assert.equal(blockedClose.open, true, "active local persistence must not be dismissed mid-save");

  const idle = reduceCaptureOverlayState(saving, { type: "set-saving", saving: false });
  const closed = reduceCaptureOverlayState(idle, { type: "close" });
  assert.deepEqual(closed, initialCaptureOverlayState);
});


test("capture sync state follows the saved client id rather than aggregate sync counts", () => {
  assert.equal(captureSyncState("cap-new", []), "synced");
  assert.equal(captureSyncState("cap-new", [{ clientId: "cap-other" }]), "synced");
  assert.equal(captureSyncState("cap-new", [{ clientId: "cap-other" }, { clientId: "cap-new" }]), "local");
});

import { isSyncCandidate, partitionSyncBatches, type OutboxItem } from "../src/lib/outbox.ts";

test("outbox retries only stale syncing records after a tab crash while leaving fresh in-flight work alone", () => {
  const now = Date.parse("2026-09-04T18:00:00.000Z");
  const base = {
    clientId: "cap-1",
    teamId: "team-1",
    createdAt: "2026-09-04T17:55:00.000Z",
    fields: { kind: "photo" },
    photo: null,
    attempts: 0,
  } as const;

  assert.equal(isSyncCandidate({ ...base, status: "pending" }, now), true);
  assert.equal(isSyncCandidate({ ...base, status: "failed" }, now), true);
  assert.equal(isSyncCandidate({ ...base, status: "syncing", syncStartedAt: "2026-09-04T17:59:50.000Z" }, now), false);
  assert.equal(isSyncCandidate({ ...base, status: "syncing", syncStartedAt: "2026-09-04T17:58:00.000Z" }, now), true);
  assert.equal(isSyncCandidate({ ...base, status: "syncing" }, now), true, "legacy syncing records without a timestamp must be recoverable");
});


test("offline sync partitions a long workshop queue into bounded batches", () => {
  const make = (n: number): OutboxItem => ({ clientId: `cap_${n}_abcdefgh`, teamId: "00000000-0000-4000-8000-000000000001", createdAt: new Date().toISOString(), fields: { kind: "problem", body: "x".repeat(64) }, photo: null, status: "pending", attempts: 0 });
  const batches = partitionSyncBatches(Array.from({ length: 19 }, (_, index) => make(index)), 8, 8 * 1024 * 1024);
  assert.deepEqual(batches.map((batch) => batch.length), [8, 8, 3]);
});

test("offline sync isolates large photo payloads instead of creating an unbounded reconnect request", () => {
  const item = (id: string, bytes: number): OutboxItem => ({ clientId: id, teamId: "00000000-0000-4000-8000-000000000001", createdAt: new Date().toISOString(), fields: { kind: "photo" }, photo: { name: "robot.jpg", type: "image/jpeg", dataBase64: "x".repeat(bytes) }, status: "pending", attempts: 0 });
  const batches = partitionSyncBatches([item("cap_a_abcdefgh", 5_000), item("cap_b_abcdefgh", 5_000)], 8, 7_000);
  assert.deepEqual(batches.map((batch) => batch.length), [1, 1]);
});
