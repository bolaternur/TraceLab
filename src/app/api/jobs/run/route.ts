import { NextResponse } from "next/server";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, sourceEvents, teamMemberships, tests, relations, notifications } from "@/db/schema";
import { log } from "@/server/audit";
import { storage } from "@/server/storage";
import { z } from "zod";

export const runtime = "nodejs";

/**
 * Database-backed job runner. Invoke from a scheduler (cron) with `Authorization: Bearer $CRON_SECRET`.
 * Jobs are claimed with SKIP LOCKED semantics so multiple runners are safe.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const claimed = await db.execute<{ id: string; kind: string; payload: Record<string, unknown>; attempts: number }>(sql`
    update jobs set status = 'running', attempts = attempts + 1
    where id in (select id from jobs where status = 'queued' and run_after <= now() order by created_at asc for update skip locked limit 10)
    returning id, kind, payload, attempts`);
  const rows = claimed.rows;
  let done = 0, failed = 0;
  for (const job of rows) {
    try {
      await runJob(job.kind, job.payload);
      await db.update(jobs).set({ status: "done", completedAt: new Date() }).where(eq(jobs.id, job.id));
      done++;
    } catch (err) {
      failed++;
      const retry = job.attempts < 5;
      await db.update(jobs).set({ status: retry ? "queued" : "failed", lastError: String(err).slice(0, 1000), runAfter: new Date(Date.now() + Math.min(60_000 * 2 ** job.attempts, 3_600_000)) }).where(eq(jobs.id, job.id));
      log("error", "job_failed", { id: job.id, kind: job.kind, err: String(err) });
    }
  }
  return NextResponse.json({ claimed: rows.length, done, failed });
}

async function runJob(kind: string, payload: Record<string, unknown>) {
  if (kind === "storage.cleanup") {
    const teamId = z.string().uuid().parse(payload.teamId);
    await storage.deletePrefix(teamId);
    log("info", "storage_cleanup_completed", { teamId });
    return;
  }
  if (kind === "notify.tests_without_decisions") {
    const teamId = String(payload.teamId);
    const linked = new Set((await db.select({ id: relations.toId }).from(relations).where(and(eq(relations.teamId, teamId), eq(relations.fromType, "decision"), eq(relations.toType, "test")))).map((r) => r.id));
    const all = await db.select({ id: tests.id, createdBy: tests.createdBy, title: tests.title }).from(tests).where(eq(tests.teamId, teamId)).orderBy(asc(tests.performedAt));
    const missing = all.filter((t) => !linked.has(t.id) && t.createdBy);
    for (const t of missing.slice(0, 5)) {
      await db.insert(notifications).values({ userId: t.createdBy!, teamId, kind: "test_missing_decision", title: `“${t.title}” has no linked decision`, body: "When you decide what to do with this result, link it — it keeps the reasoning attached.", href: `/app/tests/${t.id}` });
    }
    return;
  }
  if (kind === "notify.unsynced_reminder") {
    return; // client-side outbox reminders are handled in the PWA; server has nothing to do.
  }
  if (kind === "retention.apply") {
    const teamId = String(payload.teamId);
    const days = Number(payload.retentionDays);
    if (!Number.isFinite(days) || days <= 0) return;
    await db.update(sourceEvents).set({ status: "ignored" }).where(and(eq(sourceEvents.teamId, teamId), lte(sourceEvents.occurredAt, new Date(Date.now() - days * 86400_000)), eq(sourceEvents.status, "inbox")));
    void teamMemberships;
    return;
  }
  throw new Error(`Unknown job kind: ${kind}`);
}
