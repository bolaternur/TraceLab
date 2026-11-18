import { existsSync } from 'node:fs';
import pg from 'pg';
import { migrationEnvironment } from './production-environment.mjs';

// Use only in a separate trusted release process. No seeds, resets or db:push.
const failures = migrationEnvironment(process.env);
if (['.env', '.env.local', '.env.production', '.env.production.local'].some(file => existsSync(file))) failures.push('dotenv_files_forbidden_in_release');
if (failures.length) {
  console.error(JSON.stringify({ event: 'migration_configuration_rejected', settings: failures }));
  process.exitCode = 1;
} else {
  const runtime = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
  const owner = new pg.Pool({ connectionString: process.env.DATABASE_MIGRATION_URL, max: 1, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
  try {
    const identitySql = 'SELECT current_user AS role, current_database() AS database';
    const [runtimeIdentity, ownerIdentity] = await Promise.all([runtime.query(identitySql), owner.query(identitySql)]);
    const app = runtimeIdentity.rows[0], migration = ownerIdentity.rows[0];
    if (app.role !== process.env.DATABASE_RUNTIME_ROLE || app.role === migration.role || app.database !== migration.database) throw new Error('migration_identity_rejected');
    const permissions = (await runtime.query('SELECT rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
    if (!permissions || Object.values(permissions).some(Boolean)) throw new Error('migration_runtime_privileges_rejected');
    if (!process.argv.includes('--apply')) {
      console.log('Release identities checked read-only. Re-run with --apply to apply registered migrations.');
    } else {
      await import('./migrate-unified.mjs');
      await import('./check-migrations.mjs');
    }
  } catch {
    console.error('release_migration_failed: inspect connection, role, TLS and migration history privately; credentials were not printed');
    process.exitCode = 1;
  } finally { await runtime.end(); await owner.end(); }
}
