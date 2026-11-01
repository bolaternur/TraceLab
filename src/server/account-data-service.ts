import { pool } from "@/db";
import { AccountError, accountHash } from "./account-contract";

export const ACCOUNT_DATA_LIMITS = Object.freeze({ categoryRows: 2000, totalRows: 10000, bytes: 8 * 1024 * 1024, timeoutMs: 8000 });
const active = (team = "r.team_id") => `EXISTS(SELECT 1 FROM team_memberships own_membership WHERE own_membership.team_id=${team} AND own_membership.user_id=$1 AND own_membership.status='active')`;
const sections = [
  ["teamMemberships", "SELECT r.id,r.team_id,r.role,r.status,r.joined_at,r.left_at FROM team_memberships r WHERE r.user_id=$1 AND " + active()],
  ["organizationMemberships", "SELECT id,organization_id,role,created_at FROM organization_memberships WHERE user_id=$1"],
  ["annotations", "SELECT r.id,r.team_id,r.entity_type,r.entity_id,r.field,r.body,r.source_method,r.provenance,r.supersedes_id,r.created_at FROM annotations r WHERE r.author_user_id=$1 AND r.field<>'workspace_snapshot' AND " + active()],
  ["sourceRecords", "SELECT r.id,r.team_id,r.project_id,r.subsystem_id,r.iteration_id,r.provider,r.provider_event_id,r.event_type,r.actor_external_id,r.title,r.summary,r.occurred_at,r.received_at,r.content_hash,r.visibility,r.status,r.created_at FROM source_events r WHERE r.actor_user_id=$1 AND " + active()],
  ["iterations", "SELECT r.id,r.team_id,r.project_id,r.subsystem_id,r.title,r.state,r.problem_or_goal,r.change_summary,r.outcome,r.opened_at,r.closed_at,r.created_at FROM iterations r WHERE r.created_by=$1 AND " + active()],
  ["tests", "SELECT r.id,r.team_id,r.project_id,r.subsystem_id,r.iteration_id,r.title,r.target_type,r.target_label,r.question,r.hypothesis,r.procedure,r.independent_variable,r.metric_name,r.units,r.trials,r.successes,r.value,r.pass_criteria,r.environment,r.observations,r.outcome,r.performed_at,r.created_at FROM tests r WHERE r.created_by=$1 AND " + active()],
  ["decisions", "SELECT r.id,r.team_id,r.project_id,r.subsystem_id,r.iteration_id,r.title,r.disposition,r.status,r.alternatives,r.decided_at,r.reversed_by_id,r.created_at FROM decisions r WHERE r.author_user_id=$1 AND " + active()],
  ["relations", "SELECT r.id,r.team_id,r.from_type,r.from_id,r.to_type,r.to_id,r.relation_type,r.origin,r.status,r.invalidated_at,r.created_at FROM relations r WHERE r.created_by=$1 AND " + active()],
  ["fileReferences", "SELECT r.id,r.team_id,r.source_event_id,r.kind,r.mime_type,r.size_bytes,r.sha256,r.created_at FROM artifacts r JOIN source_events e ON e.id=r.source_event_id AND e.team_id=r.team_id WHERE e.actor_user_id=$1 AND " + active()],
  ["chatMessages", "SELECT r.id,r.team_id,r.body,r.attachment_id,r.created_at FROM workspace_chat_messages r WHERE r.user_id=$1 AND " + active()],
  ["chatFileReferences", "SELECT r.id,r.team_id,r.kind,r.mime_type,r.size_bytes,r.duration_ms,r.sha256,r.status,r.created_at FROM workspace_chat_attachments r WHERE r.user_id=$1 AND " + active()],
  ["reviews", "SELECT r.id,r.team_id,r.body,r.rating,r.created_at,r.updated_at FROM product_reviews r WHERE r.user_id=$1 AND " + active()],
  ["usageDays", "SELECT r.team_id,r.day FROM product_usage_days r WHERE r.user_id=$1 AND " + active()],
  ["notifications", "SELECT r.id,r.team_id,r.kind,r.title,r.body,r.href,r.read_at,r.created_at FROM notifications r WHERE r.user_id=$1 AND (r.team_id IS NULL OR " + active() + ")"],
] as const;

/** Own-account snapshot plus explicitly listed author-owned data in currently accessible teams. */
export async function exportAccountData(identity: { userId: string; sessionHash: string }) {
  const client = await pool.connect(), deadline = Date.now() + ACCOUNT_DATA_LIMITS.timeoutMs;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    await client.query("SELECT set_config('app.user_id',$1,true),set_config('statement_timeout','8000',true),set_config('lock_timeout','2000',true)", [identity.userId]);
    const account = (await client.query(`SELECT u.id,u.email,u.display_name,u.locale,u.age_category,u.settings,u.created_at,v.verified_at
      FROM users u JOIN account_verification v ON v.user_id=u.id AND v.verified_at IS NOT NULL
      JOIN sessions s ON s.user_id=u.id AND s.id=$2 AND s.expires_at>now() WHERE u.id=$1 FOR SHARE OF u`, [identity.userId, identity.sessionHash])).rows[0];
    if (!account) throw new AccountError("unauthenticated", 401);
    const rate = (await pool.query<{ attempts: number }>(`INSERT INTO account_rate_limits(key_hash,window_started_at,attempts) VALUES($1,now(),1)
      ON CONFLICT(key_hash) DO UPDATE SET attempts=CASE WHEN account_rate_limits.window_started_at<now()-interval '1 hour' THEN 1 ELSE account_rate_limits.attempts+1 END,
      window_started_at=CASE WHEN account_rate_limits.window_started_at<now()-interval '1 hour' THEN now() ELSE account_rate_limits.window_started_at END RETURNING attempts`, [accountHash("account-data:" + identity.userId)])).rows[0];
    if (rate.attempts > 8) throw new AccountError("rate_limited", 429);
    const optional=(await client.query<{reviews:boolean;usage_days:boolean}>("SELECT to_regclass('public.product_reviews') IS NOT NULL AS reviews,to_regclass('public.product_usage_days') IS NOT NULL AS usage_days")).rows[0];
    const unavailableOptionalCategories:string[]=[];
    let usedBytes = Buffer.byteLength(JSON.stringify(account)), totalRows = 0;
    const data: Record<string, unknown[]> = {};
    for (const [key, select] of sections) {
      if((key==="reviews"&&!optional.reviews)||(key==="usageDays"&&!optional.usage_days)){unavailableOptionalCategories.push(key);continue;}
      const remaining = deadline - Date.now(); if (remaining <= 0) throw new AccountError("service_unavailable", 503);
      await client.query("SELECT set_config('statement_timeout',$1,true)", [String(remaining)]);
      const stats = (await client.query<{ count: string; bytes: string }>(`SELECT count(*)::text AS count,COALESCE(sum(octet_length(row_to_json(item)::text)),0)::text AS bytes FROM (${select}) item`, [identity.userId])).rows[0];
      totalRows += Number(stats.count); usedBytes += Number(stats.bytes);
      if (Number(stats.count) > ACCOUNT_DATA_LIMITS.categoryRows || totalRows > ACCOUNT_DATA_LIMITS.totalRows || usedBytes > ACCOUNT_DATA_LIMITS.bytes) throw new AccountError("data_export_too_large", 413);
      data[key] = (await client.query(select + " ORDER BY 1", [identity.userId])).rows;
    }
    data.sessions = (await client.query("SELECT created_at,expires_at,(id=$2) AS current FROM sessions WHERE user_id=$1 ORDER BY created_at", [identity.userId, identity.sessionHash])).rows;
    if (data.sessions.length > ACCOUNT_DATA_LIMITS.categoryRows) throw new AccountError("data_export_too_large", 413);
    const result = { format: "iznera-account-data-v1", createdAt: new Date().toISOString(), account, data,
      coverage: { completeForIncludedCategories: true, currentActiveTeamsOnly: true, localDraftsIncluded: false, binaryFilesIncluded: false,unavailableOptionalCategories },
      exclusions: ["password hashes, session/token secrets and encrypted mail", "connector credentials and provider raw payloads", "other members' authored text", "private content in teams without active membership", "full project snapshots, binary photos/GLB/audio/PDF files and existing export bodies", "browser-only drafts and operator/security logs"],
      recovery: "This is a readable account-data snapshot, not an automatic restore or a full team backup. Download private files from the authorized workspace while you still have access. Export device drafts separately on /offline-capture.html." };
    if (Buffer.byteLength(JSON.stringify(result)) > ACCOUNT_DATA_LIMITS.bytes) throw new AccountError("data_export_too_large", 413);
    await client.query("COMMIT"); return result;
  } catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}
