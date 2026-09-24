import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, sourceConnections, sourceEvents, teamMemberships, users, webhookDeliveries } from "@/db/schema";
import { decryptSecret, sha256 } from "@/server/storage";
import { normalizeDiscord, normalizeGithubPush, normalizeOnshape, normalizeTelegram, verifyGithubSignature, type NormalizedEvent } from "@/integrations/normalize";
import { getActiveSeasonAndProject } from "@/server/evidence";
import { log, track } from "@/server/audit";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

const MAX_BODY = 1_000_000;

/**
 * Inbound source webhooks. One URL per connection: /api/webhooks/{github|telegram|discord|onshape}/{connectionId}
 * - signature / secret verification per provider
 * - idempotent on provider delivery id
 * - metadata only; never repository contents
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string; connectionId: string }> }) {
  const { provider, connectionId } = await params;
  if (!["github", "telegram", "discord", "onshape"].includes(provider)) return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/.test(connectionId)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rawBody = await req.text();
  if (rawBody.length > MAX_BODY) return NextResponse.json({ error: "payload too large" }, { status: 413 });

  const [conn] = await db.select().from(sourceConnections).where(and(eq(sourceConnections.id, connectionId), eq(sourceConnections.provider, provider))).limit(1);
  if (!conn || conn.status === "disconnected" || !conn.encryptedSecret) return NextResponse.json({ error: "not found" }, { status: 404 });
  let secrets: { webhookSecret?: string | null; token?: string | null } = {};
  try {
    secrets = JSON.parse(decryptSecret(conn.encryptedSecret));
  } catch {
    return NextResponse.json({ error: "connection misconfigured" }, { status: 500 });
  }

  // --- verification ---
  let deliveryId: string | null = null;
  if (provider === "github") {
    if (!secrets.webhookSecret || !verifyGithubSignature(rawBody, req.headers.get("x-hub-signature-256"), secrets.webhookSecret)) {
      log("warn", "webhook_signature_invalid", { provider, connectionId });
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }
    deliveryId = req.headers.get("x-github-delivery");
    const event = req.headers.get("x-github-event");
    if (event === "ping") return NextResponse.json({ ok: true, pong: true });
    if (event !== "push") return NextResponse.json({ ok: true, ignored: event });
  } else if (provider === "telegram") {
    const header = req.headers.get("x-telegram-bot-api-secret-token");
    if (!secrets.token || header !== secrets.token) return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  } else if (provider === "discord") {
    const header = req.headers.get("x-trace-webhook-secret");
    if (!secrets.webhookSecret || header !== secrets.webhookSecret) return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  } else if (provider === "onshape") {
    const header = req.headers.get("x-trace-webhook-secret");
    if (!secrets.webhookSecret || header !== secrets.webhookSecret) return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }
  deliveryId = deliveryId ?? createHash("sha256").update(rawBody).digest("hex");

  // --- idempotency ---
  const inserted = await db.insert(webhookDeliveries).values({ provider, deliveryId }).onConflictDoNothing().returning({ id: webhookDeliveries.id });
  if (inserted.length === 0) return NextResponse.json({ ok: true, duplicate: true });

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  let normalized: NormalizedEvent[] = [];
  if (provider === "github") normalized = normalizeGithubPush(payload as Parameters<typeof normalizeGithubPush>[0]);
  if (provider === "telegram") normalized = [normalizeTelegram(payload as Parameters<typeof normalizeTelegram>[0])].filter(Boolean) as NormalizedEvent[];
  if (provider === "discord") normalized = [normalizeDiscord(payload as Parameters<typeof normalizeDiscord>[0])];
  if (provider === "onshape") normalized = [normalizeOnshape(payload as Parameters<typeof normalizeOnshape>[0])].filter(Boolean) as NormalizedEvent[];

  const { season, project } = await getActiveSeasonAndProject(conn.teamId);
  const identityMap = ((conn.config as Record<string, unknown>).identityMap ?? {}) as Record<string, string>;
  let ingested = 0;
  for (const n of normalized) {
    let actorUserId: string | null = null;
    const mapped = n.actorExternalId ? identityMap[n.actorExternalId] : null;
    if (mapped) {
      const m = await db.select({ id: users.id }).from(users).innerJoin(teamMemberships, eq(teamMemberships.userId, users.id)).where(and(eq(users.email, mapped), eq(teamMemberships.teamId, conn.teamId))).limit(1);
      actorUserId = m[0]?.id ?? null;
    }
    const rows = await db
      .insert(sourceEvents)
      .values({ teamId: conn.teamId, seasonId: season?.id ?? null, projectId: project?.id ?? null, connectionId: conn.id, provider, providerEventId: n.providerEventId, eventType: n.eventType, actorExternalId: n.actorExternalId ?? null, actorUserId, title: n.title, summary: n.summary ?? null, occurredAt: n.occurredAt, rawMetadata: n.rawMetadata, contentHash: sha256(JSON.stringify(n.rawMetadata) + n.title) })
      .onConflictDoNothing()
      .returning({ id: sourceEvents.id });
    if (rows[0]) {
      ingested++;
      if (n.artifact) await db.insert(artifacts).values({ teamId: conn.teamId, sourceEventId: rows[0].id, kind: n.artifact.kind, externalReference: n.artifact.externalReference, metadata: n.artifact.metadata ?? {} });
    }
  }
  await db.update(sourceConnections).set({ lastEventAt: new Date(), lastError: null, status: "active" }).where(eq(sourceConnections.id, conn.id));
  await track("source.event_ingested", { teamId: conn.teamId, props: { provider, n: ingested } });
  return NextResponse.json({ ok: true, ingested });
}
