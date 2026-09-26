import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { annotations, artifacts, decisions, iterations, relations, sourceEvents, subsystems, tests } from "@/db/schema";
import { AuthorizationError } from "@/server/auth";
import { track } from "@/server/audit";
import { getActiveSeasonAndProject } from "@/server/evidence";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, newStorageKey, sha256, sniffContentType, storage, stripJpegMetadata } from "@/server/storage";

const optStr = (max = 2000) => z.string().trim().max(max).optional().or(z.literal("")).transform((value) => (value ? value : null));

export const captureSchema = z.object({
  kind: z.enum(["photo", "problem", "test", "decision", "reflection"]),
  clientId: z.string().trim().min(8).max(80),
  occurredAt: z.string().optional(),
  subsystemId: z.string().uuid().optional().or(z.literal("")),
  iterationId: z.string().uuid().optional().or(z.literal("")),
  caption: optStr(500),
  body: optStr(5000),
  severity: z.enum(["low", "medium", "high"]).optional().or(z.literal("")),
  title: optStr(200),
  target: optStr(200),
  trials: z.coerce.number().int().min(0).max(100000).optional().or(z.literal("")),
  successes: z.coerce.number().int().min(0).max(100000).optional().or(z.literal("")),
  value: optStr(40),
  units: optStr(30),
  outcome: z.enum(["pass", "fail", "inconclusive", "qualitative"]).optional().or(z.literal("")),
  question: optStr(1000),
  hypothesis: optStr(1000),
  procedure: optStr(3000),
  metricName: optStr(100),
  passCriteria: optStr(500),
  observations: optStr(3000),
  rationale: optStr(5000),
  alternatives: optStr(2000),
  disposition: z.enum(["keep", "revert", "iterate", "defer", "reject", "unknown"]).optional().or(z.literal("")),
  nextStep: optStr(2000),
  testId: z.string().uuid().optional().or(z.literal("")),
  learned: optStr(5000),
  failed: optStr(5000),
  change: optStr(5000),
});

export type CaptureInput = z.infer<typeof captureSchema>;

async function assertCaptureEntityInTeam(teamId: string, type: "subsystem" | "iteration" | "test", id: string) {
  const table = type === "subsystem" ? subsystems : type === "iteration" ? iterations : tests;
  const row = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.teamId, teamId))).limit(1);
  if (!row[0]) throw new AuthorizationError("Entity not found in this team.");
}

async function writeCaptureAnnotation(params: { teamId: string; entityType: string; entityId: string; field: string; body: string; authorUserId: string }) {
  const previous = await db
    .select({ id: annotations.id })
    .from(annotations)
    .where(and(eq(annotations.teamId, params.teamId), eq(annotations.entityType, params.entityType), eq(annotations.entityId, params.entityId), eq(annotations.field, params.field)))
    .orderBy(desc(annotations.createdAt))
    .limit(1);
  await db.insert(annotations).values({ ...params, sourceMethod: "typed", provenance: "student", supersedesId: previous[0]?.id ?? null });
}

/**
 * Internal capture persistence service. This module is server-only and is never a Server Action.
 * Callers must derive user identity from a verified session and verify active team membership first.
 */
export async function persistCaptureInternal(teamId: string, userId: string, rawInput: CaptureInput, file: File | null) {
  const input = captureSchema.parse(rawInput);
  const existing = await db.select({ id: sourceEvents.id }).from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.clientId, input.clientId))).limit(1);
  if (existing[0]) return { eventId: existing[0].id, deduplicated: true };

  const { season, project } = await getActiveSeasonAndProject(teamId);
  if (!project || !season) throw new Error("Team has no active project.");
  const occurredAt = input.occurredAt && !Number.isNaN(Date.parse(input.occurredAt)) ? new Date(input.occurredAt) : new Date();
  const subsystemId = input.subsystemId || null;
  const iterationId = input.iterationId || null;
  if (subsystemId) await assertCaptureEntityInTeam(teamId, "subsystem", subsystemId);
  if (iterationId) await assertCaptureEntityInTeam(teamId, "iteration", iterationId);
  if (input.testId) await assertCaptureEntityInTeam(teamId, "test", input.testId);

  let preparedFile: { bytes: Buffer; contentType: string; key: string; originalName: string } | null = null;
  if (file) {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error("Photo exceeds the 15 MB upload limit.");
    let bytes = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffContentType(bytes);
    if (!sniffed || !ALLOWED_IMAGE_TYPES.has(sniffed)) throw new Error("Only JPEG, PNG or WebP photos are accepted.");
    if (sniffed === "image/jpeg") bytes = Buffer.from(stripJpegMetadata(bytes));
    preparedFile = {
      bytes,
      contentType: sniffed,
      key: newStorageKey(teamId, sniffed === "image/png" ? "png" : sniffed === "image/webp" ? "webp" : "jpg"),
      originalName: file.name.slice(0, 120),
    };
  }

  const titles: Record<CaptureInput["kind"], string> = {
    photo: input.caption || "Workshop photo",
    problem: (input.body || "Problem observed").slice(0, 120),
    test: input.title || `Test: ${input.target ?? "untitled"}`,
    decision: input.title || (input.body || "Decision").slice(0, 120),
    reflection: "Student reflection",
  };
  const payload = JSON.stringify({ ...input, userId });

  if (preparedFile) await storage.put(preparedFile.key, preparedFile.bytes, preparedFile.contentType);
  try {
    const [event] = await db.insert(sourceEvents).values({
      teamId,
      seasonId: season.id,
      projectId: project.id,
      subsystemId,
      iterationId,
      provider: "capture",
      providerEventId: input.clientId,
      clientId: input.clientId,
      eventType: input.kind,
      actorUserId: userId,
      title: titles[input.kind],
      summary: input.kind === "problem" ? input.body : input.kind === "photo" ? input.caption : null,
      occurredAt,
      rawMetadata: { severity: input.severity || null, capturedVia: "quick_capture" },
      contentHash: sha256(payload),
      status: iterationId ? "linked" : "inbox",
    }).returning();

    if (preparedFile) {
      await db.insert(artifacts).values({
        teamId,
        sourceEventId: event.id,
        kind: "photo",
        storageKey: preparedFile.key,
        mimeType: preparedFile.contentType,
        sizeBytes: preparedFile.bytes.length,
        sha256: sha256(preparedFile.bytes),
        metadata: { metadataStripped: preparedFile.contentType === "image/jpeg", originalName: preparedFile.originalName },
      });
    }

    if (input.kind === "photo" && input.caption) await writeCaptureAnnotation({ teamId, entityType: "source_event", entityId: event.id, field: "caption", body: input.caption, authorUserId: userId });
    if (input.kind === "problem" && input.body) await writeCaptureAnnotation({ teamId, entityType: "source_event", entityId: event.id, field: "note", body: input.body, authorUserId: userId });
    if (input.kind === "reflection") {
      if (input.learned) await writeCaptureAnnotation({ teamId, entityType: "source_event", entityId: event.id, field: "reflection", body: `Learned: ${input.learned}`, authorUserId: userId });
      if (input.failed) await writeCaptureAnnotation({ teamId, entityType: "source_event", entityId: event.id, field: "reflection_failed", body: `Failed: ${input.failed}`, authorUserId: userId });
      if (input.change) await writeCaptureAnnotation({ teamId, entityType: "source_event", entityId: event.id, field: "next_step", body: `Next: ${input.change}`, authorUserId: userId });
    }

    if (input.kind === "test") {
      const trials = typeof input.trials === "number" ? input.trials : null;
      const successes = typeof input.successes === "number" ? input.successes : null;
      if (trials != null && successes != null && successes > trials) throw new Error("Successes cannot exceed trials.");
      const [test] = await db.insert(tests).values({
        teamId, projectId: project.id, subsystemId, iterationId, title: titles.test, targetType: "subsystem", targetLabel: input.target,
        question: input.question, hypothesis: input.hypothesis, procedure: input.procedure, metricName: input.metricName ?? (trials != null ? "success rate" : null),
        units: input.units, trials, successes, value: input.value && !Number.isNaN(Number(input.value)) ? input.value : null,
        passCriteria: input.passCriteria, observations: input.observations ?? input.body, outcome: input.outcome || (trials != null ? "inconclusive" : "qualitative"),
        performedAt: occurredAt, createdBy: userId,
      }).returning();
      await db.insert(relations).values({ teamId, fromType: "test", fromId: test.id, toType: "source_event", toId: event.id, relationType: "DERIVED_FROM", origin: "system", createdBy: userId }).onConflictDoNothing();
      if (input.observations || input.body) await writeCaptureAnnotation({ teamId, entityType: "test", entityId: test.id, field: "note", body: input.observations ?? input.body ?? "", authorUserId: userId });
      await track("test.created", { teamId, userId });
      if (iterationId) await db.update(iterations).set({ state: "testing" }).where(and(eq(iterations.id, iterationId), eq(iterations.teamId, teamId), eq(iterations.state, "open")));
    }

    if (input.kind === "decision") {
      if (!input.rationale) throw new Error("A decision requires the student's rationale (why).");
      const alternatives = (input.alternatives ?? "").split("\n").map((value) => value.trim()).filter(Boolean);
      const [decision] = await db.insert(decisions).values({ teamId, projectId: project.id, subsystemId, iterationId, title: titles.decision, disposition: input.disposition || "unknown", status: "closed", alternatives, decidedAt: occurredAt, authorUserId: userId }).returning();
      await writeCaptureAnnotation({ teamId, entityType: "decision", entityId: decision.id, field: "rationale", body: input.rationale, authorUserId: userId });
      if (input.nextStep) await writeCaptureAnnotation({ teamId, entityType: "decision", entityId: decision.id, field: "next_step", body: input.nextStep, authorUserId: userId });
      await db.insert(relations).values({ teamId, fromType: "decision", fromId: decision.id, toType: "source_event", toId: event.id, relationType: "DERIVED_FROM", origin: "system", createdBy: userId }).onConflictDoNothing();
      if (input.testId) {
        await db.insert(relations).values({ teamId, fromType: "decision", fromId: decision.id, toType: "test", toId: input.testId, relationType: "SUPPORTS", origin: "student", createdBy: userId }).onConflictDoNothing();
        await track("decision.linked_to_test", { teamId, userId });
      }
      await track("decision.created", { teamId, userId });
      if (iterationId && input.disposition && ["keep", "revert", "reject", "defer"].includes(input.disposition)) {
        const outcome = input.disposition === "keep" ? "kept" : input.disposition === "revert" ? "reverted" : input.disposition === "reject" ? "rejected" : "deferred";
        await db.update(iterations).set({ state: "closed", outcome, closedAt: occurredAt }).where(and(eq(iterations.id, iterationId), eq(iterations.teamId, teamId)));
        await track("iteration.closed", { teamId, userId });
      }
    }
    return { eventId: event.id, deduplicated: false };
  } catch (error) {
    if (preparedFile) await storage.delete(preparedFile.key).catch(() => undefined);
    throw error;
  }
}
