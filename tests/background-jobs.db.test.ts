import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

const enabled = process.env.RUN_BACKGROUND_JOBS_DB_TESTS === "true" && Boolean(process.env.DATABASE_URL && process.env.DATABASE_MIGRATION_URL);
describe.skipIf(!enabled)("background jobs — isolated temporary PostgreSQL schema", () => {
  const schema = "iznera_jobs_fixture_" + randomUUID().replaceAll("-", "");
  const owner = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL });
  let isolated: Pool, run: typeof import("@/server/background-jobs").runBackgroundJobs;
  const team = randomUUID(), user = randomUUID(), project = randomUUID();
  const job = async (kind: string, payload: unknown = {}, extra = "") => (await isolated.query(`INSERT INTO jobs(kind,payload${extra ? ",status,attempts,run_after" : ""}) VALUES($1,$2${extra ? "," + extra : ""}) RETURNING id`, [kind, payload])).rows[0].id as string;
  beforeAll(async () => {
    const database = (await owner.query("SELECT current_database() AS name")).rows[0].name;
    if (!/^tracelab_unified_(dev_20261026|test(?:_.*)?)$/.test(database)) throw new Error("Use the isolated tracelab_unified_* development/test database.");
    if (!/^iznera_jobs_fixture_[a-f0-9]{32}$/.test(schema)) throw new Error("Invalid test schema.");
    await owner.query(`CREATE SCHEMA "${schema}"`);
    for (const table of ["jobs", "notifications", "tests", "relations", "source_events"]) await owner.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    isolated = new Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, options: `-c search_path=${schema},public`, max: 4 });
    run = (await import("@/server/background-jobs")).runBackgroundJobs;
  });
  beforeEach(async () => { await isolated.query("TRUNCATE jobs,notifications,tests,relations,source_events"); });
  afterAll(async () => {
    if (isolated) await isolated.end();
    if (/^iznera_jobs_fixture_[a-f0-9]{32}$/.test(schema)) await owner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await owner.end();
  });
  const runIsolated = () => run(drizzle(isolated));
  it("recovers a crashed lease once, skips live leases/future jobs and stops at five attempts", async () => {
    const recovered = await job("notify.unsynced_reminder", {}, "'running',2,now()-interval '1 minute'");
    const live = await job("notify.unsynced_reminder", {}, "'running',2,now()+interval '1 hour'");
    const future = await job("notify.unsynced_reminder", {}, "'queued',0,now()+interval '1 hour'");
    const exhausted = await job("notify.unsynced_reminder", {}, "'running',5,now()-interval '1 minute'");
    expect(await runIsolated()).toEqual({ claimed: 1, done: 1, failed: 0, exhausted: 1 });
    const records = (await isolated.query("SELECT id,status,attempts,last_error FROM jobs")).rows;
    expect(records.find(row => row.id === recovered)).toMatchObject({ status: "done", attempts: 3 });
    expect(records.find(row => row.id === live)).toMatchObject({ status: "running", attempts: 2 });
    expect(records.find(row => row.id === future)).toMatchObject({ status: "queued", attempts: 0 });
    expect(records.find(row => row.id === exhausted)).toMatchObject({ status: "failed", attempts: 5, last_error: "job_lease_exhausted" });
    expect((await runIsolated()).claimed).toBe(0);
  });
  it("serializes two workers and commits each job's notifications only once", async () => {
    await isolated.query("INSERT INTO tests(team_id,project_id,created_by,title) VALUES($1,$2,$3,'Fixture result')", [team, project, user]);
    await job("notify.tests_without_decisions", { teamId: team });
    const results = await Promise.all([runIsolated(), runIsolated()]);
    expect(results.reduce((sum, result) => sum + result.done, 0)).toBe(1);
    expect((await isolated.query("SELECT count(*)::int AS count FROM notifications")).rows[0].count).toBe(1);
    await runIsolated();
    expect((await isolated.query("SELECT count(*)::int AS count FROM notifications")).rows[0].count).toBe(1);
  });
  it("rolls back partial effects, redacts failures and delays a bounded retry", async () => {
    await isolated.query("INSERT INTO tests(team_id,project_id,created_by,title) VALUES($1,$2,$3,'Private text must not enter logs')", [team, project, user]);
    const id = await job("notify.tests_without_decisions", { teamId: team });
    await isolated.query("CREATE FUNCTION fixture_fail_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='done' THEN RAISE EXCEPTION 'private fixture response'; END IF; RETURN NEW; END $$");
    await isolated.query("CREATE TRIGGER fixture_fail_completion BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION fixture_fail_completion()");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await runIsolated()).toMatchObject({ done: 0, failed: 1 });
      expect((await isolated.query("SELECT count(*)::int AS count FROM notifications")).rows[0].count).toBe(0);
      expect((await isolated.query("SELECT status,last_error,attempts,run_after>now() AS delayed FROM jobs WHERE id=$1", [id])).rows[0]).toEqual({ status: "queued", last_error: "job_execution_failed", attempts: 1, delayed: true });
      expect(log.mock.calls.flat().join(" ")).not.toMatch(/private fixture response|Private text/);
      expect((await runIsolated()).claimed).toBe(0);
    } finally { log.mockRestore(); await isolated.query("DROP TRIGGER fixture_fail_completion ON jobs"); await isolated.query("DROP FUNCTION fixture_fail_completion()"); }
    await isolated.query("UPDATE jobs SET run_after=now()-interval '1 second' WHERE id=$1", [id]);
    expect((await runIsolated()).done).toBe(1);
    expect((await isolated.query("SELECT count(*)::int AS count FROM notifications")).rows[0].count).toBe(1);
  });
  it("fails unsupported/malformed/legacy cleanup jobs without deleting evidence or retrying", async () => {
    const ids = [await job("storage.cleanup", { prefix: "private/team" }), await job("retention.apply", { teamId: "invalid", retentionDays: 30 }), await job("unknown-private-kind")];
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try { expect(await runIsolated()).toMatchObject({ done: 0, failed: 3 }); } finally { log.mockRestore(); }
    expect((await isolated.query("SELECT status,attempts FROM jobs WHERE id=ANY($1::uuid[])", [ids])).rows).toEqual(Array.from({ length: 3 }, () => ({ status: "failed", attempts: 1 })));
    expect((await runIsolated()).claimed).toBe(0);
  });
});
