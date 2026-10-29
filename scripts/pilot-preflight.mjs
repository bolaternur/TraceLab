import { config } from 'dotenv';
import pg from 'pg';
import { pathToFileURL } from 'node:url';
import { databaseRuntimeRole } from './database-runtime-role.mjs';

const invalidSecret = value => !value || value.length < 32 || /change[_ -]?me|example|^<|^test[-_ ]|^ci-only/i.test(value);
const loopback = hostname => ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
function parsedUrl(value, protocols) {
  try { const url = new URL(value); return protocols.includes(url.protocol) ? url : null; } catch { return null; }
}

/** Configuration checks only. Values and provider responses are never included in results. */
export function pilotEnvironmentChecks(env) {
  const checks = [];
  const add = (id, good, pass, fail) => checks.push({ id, status: good ? 'pass' : 'fail', message: good ? pass : fail });
  const warn = (id, message) => checks.push({ id, status: 'manual', message });
  add('runtime.production', env.NODE_ENV === 'production', 'Production runtime selected.', 'Set NODE_ENV=production on the deployed server.');
  const app = parsedUrl(env.APP_URL, ['https:']);
  add('app.origin', Boolean(app && !loopback(app.hostname) && !app.username && !app.password && app.pathname === '/' && !app.search && !app.hash),
    'Public HTTPS origin configured.', 'Set APP_URL to the exact public HTTPS origin, without a path, credentials, query or fragment.');
  const database = parsedUrl(env.DATABASE_URL, ['postgres:', 'postgresql:']);
  let runtimeRole;
  try { runtimeRole = databaseRuntimeRole(env.DATABASE_URL, env.DATABASE_RUNTIME_ROLE); } catch { /* A failed setting is reported without serializing it. */ }
  add('database.runtime', Boolean(database && database.username && database.password && database.pathname.length > 1 && runtimeRole && !['postgres', 'root'].includes(runtimeRole)),
    'Runtime database connection configured; permissions require the read-only DB check.', 'Set DATABASE_URL to a dedicated restricted runtime role, not postgres/root.');
  const owner = parsedUrl(env.DATABASE_MIGRATION_URL, ['postgres:', 'postgresql:']);
  if (env.DATABASE_MIGRATION_URL) {
    add('database.separation', Boolean(owner && database && decodeURIComponent(owner.username) !== decodeURIComponent(database.username)),
      'Migration and runtime usernames differ.', 'Use a separate migration owner; never run the application as that owner.');
    warn('database.owner-secret', 'Remove DATABASE_MIGRATION_URL from the running web process after release migration; keep it in the trusted release job.');
  }
  add('security.encryption', !invalidSecret(env.SECRETS_ENCRYPTION_KEY), 'Persistent encryption key configured.', 'Set a persistent random SECRETS_ENCRYPTION_KEY of at least 32 characters.');
  add('security.jobs', !invalidSecret(env.CRON_SECRET), 'Protected job credential configured.', 'Set a random CRON_SECRET of at least 32 characters.');
  add('security.development-flags', env.DEV_AUTH_BYPASS !== 'true' && env.ENABLE_DEV_SIMULATOR !== 'true' && !['fake'].includes(env.AI_PROVIDER),
    'Development bypass/simulator/fake provider disabled.', 'Disable DEV_AUTH_BYPASS, ENABLE_DEV_SIMULATOR and fake AI before the pilot.');
  const sender = String(env.MAIL_FROM || '').match(/(?:<)?([^<>\s]+@[^<>\s]+)(?:>)?$/)?.[1];
  const senderDomain = sender?.split('@')[1]?.toLowerCase();
  add('mail.production', env.MAIL_TRANSPORT === 'resend' && env.MAIL_ENABLE_EXTERNAL_DELIVERY === 'true'
    && env.MAIL_PREVIEW_ENABLED === 'false' && Boolean(env.RESEND_API_KEY) && Boolean(sender)
    && !/[\r\n]/.test(env.MAIL_FROM || '') && !/^(resend\.dev|localhost)$|\.(test|invalid|example)$/.test(senderDomain || ''),
    'Resend production settings configured; this does not verify a real delivery.', 'Configure Resend, a verified-domain MAIL_FROM, RESEND_API_KEY, external delivery=true and preview=false.');
  if (env.STORAGE_PROVIDER === 'supabase') {
    const storage = parsedUrl(env.SUPABASE_URL, ['https:']);
    add('storage.configuration', Boolean(storage && !storage.username && !storage.password && storage.pathname === '/' && !storage.search && !storage.hash
      && env.SUPABASE_SERVICE_ROLE_KEY && /^[a-zA-Z0-9_-]+$/.test(env.SUPABASE_STORAGE_BUCKET || '')),
    'Supabase settings configured; bucket privacy and real upload/download need the smoke test.', 'Configure SUPABASE_URL, server-only SUPABASE_SERVICE_ROLE_KEY and SUPABASE_STORAGE_BUCKET.');
  } else if (env.STORAGE_PROVIDER === 'local' && env.STORAGE_ROOT) {
    warn('storage.persistence', 'Local storage selected: verify a private persistent disk, capacity and a combined DB+files restore before inviting teams.');
  } else add('storage.configuration', false, '', 'Select private Supabase storage, or explicitly configure a persistent private local STORAGE_ROOT.');
  if(env.TRUST_PROXY==='true'){
    const hops=Number(env.TRUST_PROXY_HOPS??'1');
    add('proxy.hops',Number.isInteger(hops)&&hops>=1&&hops<=5,'Trusted proxy count is bounded; verify that count against the deployed chain.','Set TRUST_PROXY_HOPS to the verified trusted proxy count between 1 and 5.');
  }
  warn('proxy.identity', env.TRUST_PROXY === 'true'
    ? 'TRUST_PROXY=true: verify the trusted proxy suffix and count in X-Forwarded-For; block direct access. Public Host and HTTPS headers must match APP_URL.'
    : 'TRUST_PROXY is disabled: public account requests share one network rate-limit bucket. Configure trusted proxy identity before a multi-team test.');
  warn('operator.smoke-test', 'Still required: two real verified accounts, team-code join, cross-team denial, files, PDF, mailbox recovery, restart and backup/restore. See docs/PILOT_LAUNCH.md.');
  return checks;
}

export async function pilotDatabaseChecks(connectionString, expectedRole) {
  const pool = new pg.Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  try {
    const role = (await pool.query(`SELECT r.rolname,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,
      EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind IN ('r','p') AND pg_has_role(current_user,c.relowner,'MEMBER')) AS owns_tables
      FROM pg_roles r WHERE r.rolname=current_user`)).rows[0];
    const safe = role && (!expectedRole || role.rolname === expectedRole) && !role.rolsuper && !role.rolbypassrls && !role.rolcreatedb && !role.rolcreaterole && !role.owns_tables;
    const required = ['account_verification', 'workspace_project_state', 'workspace_entity_map', 'workspace_requests', 'workspace_export_jobs'];
    const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY($1::text[])", [required])).rows;
    const present = new Set(tables.map(row => row.tablename));
    return [
      { id: 'database.reachable', status: 'pass', message: 'Runtime PostgreSQL connection responded.' },
      { id: 'database.permissions', status: safe ? 'pass' : 'fail', message: safe ? 'Runtime has no owner/superuser/BYPASSRLS/role-creation/database-creation privileges.' : 'Runtime role is too privileged. Fix ownership and grants before public access.' },
      { id: 'database.schema', status: required.every(table => present.has(table)) ? 'pass' : 'fail', message: required.every(table => present.has(table)) ? 'Unified application tables exist; run check-migrations with the release owner for exact history.' : 'Unified application tables are missing. Apply registered migrations with the separate owner.' },
    ];
  } catch {
    return [{ id: 'database.reachable', status: 'fail', message: 'Runtime database connection/check failed. Inspect credentials, TLS and reachability privately; no connection details were printed.' }];
  } finally { await pool.end(); }
}

async function main() {
  const envFile = process.argv.find(arg => arg.startsWith('--env-file='))?.slice('--env-file='.length);
  if (envFile) config({ path: envFile, quiet: true });
  const checks = pilotEnvironmentChecks(process.env);
  if (process.argv.includes('--check-db')) checks.push(...await pilotDatabaseChecks(process.env.DATABASE_URL, process.env.DATABASE_RUNTIME_ROLE));
  const configurationReady = !checks.some(check => check.status === 'fail');
  if (process.argv.includes('--json')) console.log(JSON.stringify({ configurationReady, publicPilotVerified: false, checks }, null, 2));
  else {
    for (const check of checks) console.log(`[${check.status.toUpperCase()}] ${check.id}: ${check.message}`);
    console.log(configurationReady ? 'Configuration checks passed. Manual pilot checks are still required.' : 'Public pilot configuration is incomplete. Local development can continue.');
  }
  if (!configurationReady) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
