import { config } from 'dotenv';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { databaseRuntimeRole } from './database-runtime-role.mjs';
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true });
if (!process.env.DATABASE_MIGRATION_URL) throw new Error('DATABASE_MIGRATION_URL is required; migrations never run with the application role.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_MIGRATION_URL });
const runtimeRole = databaseRuntimeRole(process.env.DATABASE_URL, process.env.DATABASE_RUNTIME_ROLE);
const runtimePool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000 });
try {
  const identity = (await runtimePool.query('SELECT current_user AS role')).rows[0];
  if (identity?.role !== runtimeRole) throw new Error('Runtime connection identity does not match DATABASE_RUNTIME_ROLE. No grants were applied.');
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  await pool.query(`GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`);
  await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${runtimeRole}"`);
  await pool.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${runtimeRole}"`);
  // Narrow SECURITY DEFINER helpers are never executable by PUBLIC.
  for (const signature of ['workspace_member_role(uuid)', 'workspace_create_team(text,text,text,text,text,text)', 'workspace_join_invite(text)', 'workspace_github_credential(uuid)', 'workspace_manage_member(uuid,uuid,text,text,text,text)', 'workspace_update_team(uuid,text,text,text,integer)']) {
    await pool.query(`GRANT EXECUTE ON FUNCTION public.${signature} TO "${runtimeRole}"`);
  }
  console.log('Registered migrations applied. Runtime grants refreshed; migration history preserved.');
} finally { await runtimePool.end(); await pool.end(); }
