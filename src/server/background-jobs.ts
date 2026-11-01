import { and, asc, eq, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs, sourceEvents, tests, relations, notifications } from "@/db/schema";
import { log } from "@/server/audit";

export const JOB_MAX_ATTEMPTS = 5;
export const JOB_LEASE_SECONDS = 600;
type Job = { id: string; kind: string; payload: Record<string, unknown>; attempts: number };
type JobsDatabase = Pick<typeof db, "execute" | "transaction">;
type JobTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const teamPayload = z.object({ teamId: z.string().uuid() });
class JobError extends Error { constructor(readonly code: string, readonly retry: boolean) { super(code); } }

async function executeJob(tx: JobTransaction, job: Job) {
  if (job.kind === "storage.cleanup") throw new JobError("legacy_storage_cleanup_disabled", false);
  if (job.kind === "notify.unsynced_reminder") return;
  if (job.kind === "notify.tests_without_decisions") {
    const payload = teamPayload.safeParse(job.payload);
    if (!payload.success) throw new JobError("job_payload_invalid", false);
    const { teamId } = payload.data;
    const linked = new Set((await tx.select({ id: relations.toId }).from(relations).where(and(eq(relations.teamId, teamId), eq(relations.fromType, "decision"), eq(relations.toType, "test"), sql`${relations}.invalidated_at IS NULL`))).map(row => row.id));
    const all = await tx.select({ id: tests.id, createdBy: tests.createdBy, title: tests.title }).from(tests).where(eq(tests.teamId, teamId)).orderBy(asc(tests.performedAt));
    for (const test of all.filter(test => !linked.has(test.id) && test.createdBy).slice(0, 5)) {
      await tx.insert(notifications).values({ userId: test.createdBy!, teamId, kind: "test_missing_decision", title: `“${test.title}” has no linked decision`, body: "When you decide what to do with this result, link it — it keeps the reasoning attached.", href: `/app/tests/${test.id}` });
    }
    return;
  }
  if (job.kind === "retention.apply") {
    const payload = teamPayload.extend({ retentionDays: z.number().int().min(1).max(36500) }).safeParse(job.payload);
    if (!payload.success) throw new JobError("job_payload_invalid", false);
    await tx.update(sourceEvents).set({ status: "ignored" }).where(and(eq(sourceEvents.teamId, payload.data.teamId), lte(sourceEvents.occurredAt, new Date(Date.now() - payload.data.retentionDays * 86400_000)), eq(sourceEvents.status, "inbox")));
    return;
  }
  throw new JobError("job_kind_unsupported", false);
}

/** DB-only handlers commit effects and completion together. run_after is the running lease expiry. */
export async function runBackgroundJobs(connection: JobsDatabase = db) {
  const expired = await connection.execute(sql`
    UPDATE jobs SET status='failed',last_error='job_lease_exhausted'
    WHERE status='running' AND run_after<=now() AND attempts>=${JOB_MAX_ATTEMPTS}
    RETURNING id`);
  const claimed = await connection.execute<Job>(sql`
    UPDATE jobs SET status='running',attempts=attempts+1,run_after=now()+(${JOB_LEASE_SECONDS}*interval '1 second')
    WHERE id IN (SELECT id FROM jobs WHERE attempts<${JOB_MAX_ATTEMPTS}
      AND status IN ('queued','running') AND run_after<=now()
      ORDER BY created_at ASC FOR UPDATE SKIP LOCKED LIMIT 10)
    RETURNING id,kind,payload,attempts`);
  let done = 0, failed = 0;
  for (const job of claimed.rows) {
    try {
      const committed = await connection.transaction(async tx => {
        const owned = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, job.id), eq(jobs.status, "running"), eq(jobs.attempts, job.attempts))).for("update");
        if (!owned.length) return false;
        await executeJob(tx, job);
        await tx.update(jobs).set({ status: "done", completedAt: new Date(), lastError: null }).where(eq(jobs.id, job.id));
        return true;
      });
      if (committed) done++;
    } catch (error) {
      failed++;
      const code = error instanceof JobError ? error.code : "job_execution_failed";
      const retry = job.attempts < JOB_MAX_ATTEMPTS && !(error instanceof JobError && !error.retry);
      await connection.execute(sql`UPDATE jobs SET status=${retry ? "queued" : "failed"},last_error=${code},
        run_after=now()+(${Math.min(60 * 2 ** job.attempts, 3600)}*interval '1 second')
        WHERE id=${job.id} AND status='running' AND attempts=${job.attempts}`);
      log("error", "job_failed", { id: job.id, code });
    }
  }
  return { claimed: claimed.rows.length, done, failed, exhausted: expired.rowCount ?? 0 };
}
