import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { parse } from 'dotenv';
import pg from 'pg';

// Creates a separate development database. Never migrates or seeds the legacy DB.
const envPath = path.resolve('.env.local');
try { await access(envPath); console.log('.env.local already exists; no configuration changed.'); process.exit(0); } catch {}
const adminFile = process.argv.find(value => value.startsWith('--admin-env='))?.slice(12);
const source = adminFile ? parse(await readFile(adminFile)) : process.env;
const url = new URL(source.DATABASE_MIGRATION_URL || source.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/postgres');
if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Local setup only accepts a loopback PostgreSQL host.');
const port = Number(url.port || 5432);
const listening = await new Promise(resolve => {
  const socket = net.createConnection({ host: url.hostname, port });
  const finish = ready => { socket.destroy(); resolve(ready); };
  socket.setTimeout(1000); socket.once('connect', () => finish(true)); socket.once('error', () => finish(false)); socket.once('timeout', () => finish(false));
});
if (!listening) {
  const base = path.join(process.env.LOCALAPPDATA || '', 'TraceLab');
  const result = spawnSync(path.join(base, 'postgresql-17.11/pgsql/bin/pg_ctl.exe'), ['start', '-D', path.join(base, 'data'), '-l', path.join(base, 'postgresql.log'), '-w'], { windowsHide: true, stdio: 'pipe', timeout: 30000 });
  if (result.status !== 0) throw new Error('Start the existing local PostgreSQL server first. No database was changed.');
}
url.pathname = '/postgres';
const admin = new pg.Client({ connectionString: url.toString() });
await admin.connect();
const database = 'tracelab_unified_dev_20261026';
const role = 'tracelab_web_runtime';
const password = randomBytes(32).toString('hex');
try {
  const existing = await admin.query('SELECT datname FROM pg_database WHERE datname=$1', [database]);
  if (existing.rowCount) throw new Error('The dedicated database already exists. Configure it explicitly; setup will not overwrite it.');
  const roleExists = await admin.query('SELECT rolname FROM pg_roles WHERE rolname=$1', [role]);
  if (roleExists.rowCount) throw new Error('Runtime role already exists. Setup will not rotate existing credentials.');
  await admin.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`);
  await admin.query(`CREATE DATABASE ${database}`);
  url.pathname = '/' + database;
  const migrationUrl = url.toString();
  url.username = role; url.password = password;
  await writeFile(envPath, [
    '# Local development only. Generated without copying legacy data.',
    'APP_URL=http://localhost:3000', 'DEV_AUTH_BYPASS=false', 'ENABLE_DEV_SIMULATOR=false',
    `DATABASE_URL=${url}`, `DATABASE_MIGRATION_URL=${migrationUrl}`,
    `SECRETS_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`, `CRON_SECRET=${randomBytes(32).toString('hex')}`,
    'MAIL_TRANSPORT=local', 'MAIL_PREVIEW_ENABLED=true', 'MAIL_FROM=TraceLab <local@tracelab.test>', 'MAIL_ENABLE_EXTERNAL_DELIVERY=false', 'AI_PROVIDER=disabled',
    'STORAGE_PROVIDER=local', '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log(`Created isolated database ${database} and a runtime role without owner/superuser privileges. Configuration saved in .env.local; no secrets printed.`);
} finally { await admin.end(); }
