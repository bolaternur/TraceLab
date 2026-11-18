import { config } from 'dotenv';
import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readdir, lstat, realpath, readFile, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// A real DB + private-file restore rehearsal using synthetic data only.
// Never dumps, migrates, cleans, restores over or deletes an existing database.
config({ path: '.env.local', quiet: true }); config({ path: '.env', quiet: true });
const migration = new URL(process.env.DATABASE_MIGRATION_URL || '');
const runtime = new URL(process.env.DATABASE_URL || '');
if (process.env.NODE_ENV === 'production' || ![migration, runtime].every(url =>
  ['postgres:', 'postgresql:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && !url.search && !url.hash)
  || migration.hostname !== runtime.hostname || (migration.port || '5432') !== (runtime.port || '5432'))
  throw new Error('Recovery requires plain same-server local PostgreSQL URLs without query overrides, outside production.');
const token = `${Date.now()}_${randomBytes(4).toString('hex')}`;
const sourceName = `tracelab_unified_test_recovery_${token}`, restoredName = sourceName + '_restored';
if (restoredName.length > 63) throw new Error('Invalid disposable name.');
const runRoot = path.resolve('.data/recovery-rehearsals', token);
const sourceFiles = path.join(runRoot, 'source-files'), backupFiles = path.join(runRoot, 'backup-files'), restoredFiles = path.join(runRoot, 'restored-files');
const fixturePath = path.join(runRoot, 'synthetic-fixture.json'), dump = path.join(runRoot, 'database.dump');
const bin = process.env.PG_BIN || path.join(process.env.LOCALAPPDATA || '', 'TraceLab', 'postgresql-17.11', 'pgsql', 'bin');
const adminUrl = new URL(migration); adminUrl.pathname = '/postgres';
const admin = new pg.Pool({ connectionString: adminUrl.href, max: 1, connectionTimeoutMillis: 10000 });
const childEnv = database => {
  const ownerUrl = new URL(migration), appUrl = new URL(runtime); ownerUrl.pathname = '/' + database; appUrl.pathname = '/' + database;
  return { ...process.env, DATABASE_URL: appUrl.href, DATABASE_MIGRATION_URL: ownerUrl.href, STORAGE_PROVIDER: 'local',
    IZNERA_RECOVERY_DATABASE: database, STORAGE_ROOT: database === sourceName ? sourceFiles : restoredFiles };
};
function node(args, env) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw new Error(`Recovery step failed: ${args[0]}. Synthetic evidence retained.`);
}
function postgres(name, args) {
  const env = { ...process.env, PGHOST: migration.hostname, PGPORT: migration.port || '5432',
    PGUSER: decodeURIComponent(migration.username), PGPASSWORD: decodeURIComponent(migration.password) };
  const result = spawnSync(path.join(bin, name + (process.platform === 'win32' ? '.exe' : '')), args, { env, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`${name} failed. Existing databases remain untouched; synthetic evidence retained.`);
}
async function inventory(root, relative = '') {
  const entries = [];
  for (const item of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const key = path.join(relative, item.name), absolute = path.resolve(root, key);
    if (!absolute.startsWith(path.resolve(root) + path.sep)) throw new Error('File escaped synthetic storage root.');
    const details = await lstat(absolute);
    if (details.isSymbolicLink()) throw new Error('Recovery rehearsal refuses links/junctions.');
    if (details.isDirectory()) entries.push(...await inventory(root, key));
    else if (details.isFile()) {
      if (details.size > 32 * 1024 * 1024) throw new Error('Unexpected large fixture object.');
      entries.push({ key: key.replaceAll(path.sep, '/'), bytes: details.size,
        sha256: createHash('sha256').update(await readFile(absolute)).digest('hex') });
    } else throw new Error('Unsupported fixture object.');
    if (entries.length > 100) throw new Error('Unexpected fixture object count.');
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}
async function copyObjects(from, to, entries) {
  await mkdir(to, { recursive: false });
  for (const { key } of entries) {
    const target = path.resolve(to, key);
    if (!target.startsWith(path.resolve(to) + path.sep)) throw new Error('Invalid recovery target.');
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.resolve(from, key), target);
  }
}
try {
  const allowed = (await admin.query('SELECT rolsuper OR rolcreatedb AS allowed FROM pg_roles WHERE rolname=current_user')).rows[0]?.allowed;
  if (!allowed) throw new Error('Local migration role needs CREATEDB for an isolated rehearsal.');
  const workspace = await realpath(process.cwd());
  let checked = process.cwd();
  for (const part of ['.data', 'recovery-rehearsals']) {
    checked = path.join(checked, part);
    await mkdir(checked).catch(error => { if (error.code !== 'EEXIST') throw error; });
    const details = await lstat(checked), resolved = await realpath(checked);
    if (!details.isDirectory() || details.isSymbolicLink() || !resolved.startsWith(workspace + path.sep))
      throw new Error('Recovery directory must be a plain directory inside this workspace, without junctions.');
  }
  await mkdir(runRoot, { recursive: false });
  await mkdir(sourceFiles);
  await admin.query(`CREATE DATABASE "${sourceName}" TEMPLATE template0`);
  console.log(`Created new synthetic source database: ${sourceName}`);
  node(['scripts/migrate-unified.mjs'], childEnv(sourceName));
  node(['--import', 'tsx', 'scripts/recovery-fixture.mts', 'seed', fixturePath], childEnv(sourceName));
  // The seed process has exited; no app or worker writes to this dedicated DB/root.
  const entries = await inventory(sourceFiles);
  if (entries.length < 3) throw new Error('Expected private photo, thumbnail and report.');
  postgres('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', '--file', dump, sourceName]);
  await copyObjects(sourceFiles, backupFiles, entries);
  if (JSON.stringify(entries) !== JSON.stringify(await inventory(backupFiles))) throw new Error('Backup file checksum mismatch.');
  await admin.query(`CREATE DATABASE "${restoredName}" TEMPLATE template0`);
  postgres('pg_restore', ['--exit-on-error', '--no-owner', '--no-privileges', '--dbname', restoredName, dump]);
  // Reapply restricted runtime grants; restored registered migrations do not rerun.
  node(['scripts/migrate-unified.mjs'], childEnv(restoredName));
  await copyObjects(backupFiles, restoredFiles, entries);
  if (JSON.stringify(entries) !== JSON.stringify(await inventory(restoredFiles))) throw new Error('Restored file checksum mismatch.');
  node(['--import', 'tsx', 'scripts/recovery-fixture.mts', 'verify', fixturePath], childEnv(restoredName));
  const report = { checkedAt: new Date().toISOString(), syntheticOnly: true, sourceName, restoredName, objects: entries,
    dumpSha256: createHash('sha256').update(await readFile(dump)).digest('hex'), result: 'passed',
    scope: 'PostgreSQL plus private local disk objects; application-authenticated reads and foreign-user denial.',
    notVerified: ['Supabase/cloud snapshots', 'point-in-time recovery', 'continuous writes during backup', 'production encryption/retention/key custody'],
    retained: 'Both disposable databases and fixture files remain for inspection. No existing data was deleted.' };
  await writeFile(path.join(runRoot, 'recovery-result.json'), JSON.stringify(report, null, 2));
  console.log(`PASS: combined local DB + ${entries.length} private objects restored and checked. Evidence: ${runRoot}`);
} finally { await admin.end(); }
