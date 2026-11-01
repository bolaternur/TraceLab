import { NextResponse } from "next/server";
import { authorizedCron } from "@/server/cron-auth";
import { runBackgroundJobs } from "@/server/background-jobs";
import { log } from "@/server/audit";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };

/**
 * Database-backed job runner. Invoke from a scheduler (cron) with `Authorization: Bearer $CRON_SECRET`.
 * Jobs are claimed with SKIP LOCKED semantics so multiple runners are safe.
 */
export async function POST(req: Request) {
  if (!authorizedCron(req.headers, process.env.CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const result = await runBackgroundJobs();
    return NextResponse.json(result, { status: result.failed || result.exhausted ? 503 : 200, headers });
  } catch {
    log("error", "job_runner_unavailable");
    return NextResponse.json({ error: "job_runner_unavailable" }, { status: 503, headers });
  }
}
