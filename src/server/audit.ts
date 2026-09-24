import { db } from "@/db";
import { analyticsEvents, auditEvents, jobs, notifications } from "@/db/schema";

export async function audit(params: {
  teamId?: string | null;
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditEvents).values({
    teamId: params.teamId ?? null,
    organizationId: params.organizationId ?? null,
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    metadata: params.metadata ?? {},
  });
}

/** Product analytics: IDs and event names only — never private source text. */
export async function track(name: string, params: { teamId?: string | null; userId?: string | null; props?: Record<string, unknown> } = {}) {
  try {
    await db.insert(analyticsEvents).values({ name, teamId: params.teamId ?? null, userId: params.userId ?? null, props: params.props ?? {} });
  } catch (err) {
    console.warn(JSON.stringify({ level: "warn", msg: "analytics_failed", name, err: String(err) }));
  }
}

export async function notify(params: { userId: string; teamId?: string | null; kind: string; title: string; body?: string; href?: string }) {
  await db.insert(notifications).values({
    userId: params.userId,
    teamId: params.teamId ?? null,
    kind: params.kind,
    title: params.title,
    body: params.body ?? null,
    href: params.href ?? null,
  });
}

/** Database-backed job queue (no external broker in this environment). */
export async function enqueueJob(kind: string, payload: Record<string, unknown>, idempotencyKey?: string) {
  await db
    .insert(jobs)
    .values({ kind, payload, idempotencyKey: idempotencyKey ?? null })
    .onConflictDoNothing();
}

export function log(level: "info" | "warn" | "error", msg: string, fields: Record<string, unknown> = {}) {
  const line = JSON.stringify({ level, msg, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
