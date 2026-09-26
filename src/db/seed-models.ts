import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { artifacts, robotModels, sourceEvents } from "./schema";
import { sha256, storage } from "../server/storage";

const SEED_MODELS = [
  {
    slug: "assembly-3209",
    file: "assembly-3209.glb",
    originalFile: "3209-0001-0007.obj",
    name: "Assembly 3209",
    category: "assembly",
    versionLabel: "Web prototype v1",
    description: "Optimized browser edition of the attached 3209 robotic assembly.",
    tags: ["robotics", "assembly", "3209", "optimized"],
  },
  {
    slug: "kicker-insert",
    file: "kicker-insert.glb",
    originalFile: "kicker_insert.obj + kicker_insert.mtl",
    name: "Kicker Insert",
    category: "part",
    versionLabel: "Prototype v1",
    description: "Kicker insert prototype with the supplied glossy yellow material.",
    tags: ["robotics", "kicker", "insert", "prototype"],
  },
] as const;

export async function seedDemoModels(input: { teamId: string; userId: string; projectId?: string | null }) {
  for (const model of SEED_MODELS) {
    const providerEventId = `seed-model-${model.slug}-v1`;
    const existing = await db
      .select({ id: robotModels.id })
      .from(robotModels)
      .innerJoin(sourceEvents, eq(sourceEvents.id, robotModels.sourceEventId))
      .where(and(eq(robotModels.teamId, input.teamId), eq(sourceEvents.providerEventId, providerEventId)))
      .limit(1);
    if (existing[0]) continue;

    const bytes = await readFile(path.join(process.cwd(), "assets", "seed", "models", model.file));
    const digest = sha256(bytes);
    const storageKey = `${input.teamId}/models/seed/${model.file}`;
    await storage.put(storageKey, bytes, "model/gltf-binary");

    const [event] = await db
      .insert(sourceEvents)
      .values({
        teamId: input.teamId,
        projectId: input.projectId ?? null,
        provider: "upload",
        providerEventId,
        eventType: "cad_revision",
        actorUserId: input.userId,
        title: `${model.name} imported`,
        summary: `Converted from ${model.originalFile} to a browser-safe private GLB artifact.`,
        occurredAt: new Date("2026-09-26T00:00:00.000Z"),
        rawMetadata: { originalFile: model.originalFile, conversion: "TraceLab streaming OBJ optimizer", seed: true },
        contentHash: digest,
        status: "linked",
      })
      .onConflictDoNothing()
      .returning();

    const sourceEvent = event ?? (await db.select().from(sourceEvents).where(and(eq(sourceEvents.teamId, input.teamId), eq(sourceEvents.provider, "upload"), eq(sourceEvents.providerEventId, providerEventId))).limit(1))[0];
    if (!sourceEvent) throw new Error(`Could not create source event for ${model.name}`);

    const [artifact] = await db
      .insert(artifacts)
      .values({
        teamId: input.teamId,
        sourceEventId: sourceEvent.id,
        kind: "cad_model",
        storageKey,
        mimeType: "model/gltf-binary",
        sizeBytes: bytes.byteLength,
        sha256: digest,
        metadata: { originalFile: model.originalFile, optimizedForWeb: true },
      })
      .returning();

    await db.insert(robotModels).values({
      teamId: input.teamId,
      projectId: input.projectId ?? null,
      sourceEventId: sourceEvent.id,
      artifactId: artifact.id,
      name: model.name,
      category: model.category,
      versionLabel: model.versionLabel,
      description: model.description,
      tags: [...model.tags],
      createdBy: input.userId,
    });
  }
}
