import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotEnvironmentChecks } from '../scripts/pilot-preflight.mjs';
import { databaseRuntimeRole } from '../scripts/database-runtime-role.mjs';

const configured = () => ({
  NODE_ENV: 'production', APP_URL: 'https://pilot.tracelab.example.org',
  DATABASE_URL: 'postgresql://tracelab_runtime:private-database-password@db.example.org:5432/tracelab',
  SECRETS_ENCRYPTION_KEY: 'fixture-random-encryption-key-with-40-characters', CRON_SECRET: 'fixture-random-worker-secret-with-40-characters',
  MAIL_TRANSPORT: 'resend', MAIL_ENABLE_EXTERNAL_DELIVERY: 'true', MAIL_PREVIEW_ENABLED: 'false',
  MAIL_FROM: 'Iznera <accounts@pilot.example.org>', RESEND_API_KEY: 'private-provider-key',
  STORAGE_PROVIDER: 'supabase', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'private-storage-key', SUPABASE_STORAGE_BUCKET: 'tracelab-private',
  AI_PROVIDER: 'disabled',
});
const failed = env => pilotEnvironmentChecks(env).filter(check => check.status === 'fail').map(check => check.id);

test('configured settings can pass without claiming verified public readiness', () => {
  assert.deepEqual(failed(configured()), []);
  assert.ok(pilotEnvironmentChecks(configured()).some(check => check.id === 'operator.smoke-test' && check.status === 'manual'));
});
test('local settings are reported as incomplete for a public pilot', () => {
  const failures = failed({ NODE_ENV: 'development', APP_URL: 'http://localhost:3000', MAIL_TRANSPORT: 'local', MAIL_PREVIEW_ENABLED: 'true' });
  for (const id of ['runtime.production','app.origin','database.runtime','mail.production','storage.configuration']) assert.ok(failures.includes(id));
});
test('origin rejects HTTPS loopback, credentials, paths and ambiguous components', () => {
  for (const APP_URL of ['https://localhost', 'https://name:secret@example.org', 'https://example.org/app', 'https://example.org/?x=1', 'https://example.org/#fragment']) {
    assert.ok(failed({ ...configured(), APP_URL }).includes('app.origin'));
  }
});
test('runtime owner reuse and development access switches fail closed', () => {
  const env = configured();
  assert.ok(failed({ ...env, DATABASE_MIGRATION_URL: env.DATABASE_URL }).includes('database.separation'));
  assert.ok(failed({ ...env, DATABASE_URL: 'postgresql://postgres:password@db.example.org/tracelab' }).includes('database.runtime'));
  assert.ok(failed({ ...env, DATABASE_URL: 'postgresql://postgres.projectref:password@pool.example.org/tracelab', DATABASE_RUNTIME_ROLE: 'postgres' }).includes('database.runtime'));
  for (const flag of ['DEV_AUTH_BYPASS','ENABLE_DEV_SIMULATOR']) assert.ok(failed({ ...env, [flag]: 'true' }).includes('security.development-flags'));
});
test('public mail requires explicit delivery, no preview and a non-sandbox sender', () => {
  const env = configured();
  for (const overrides of [{ MAIL_PREVIEW_ENABLED: 'true' }, { MAIL_ENABLE_EXTERNAL_DELIVERY: 'false' }, { MAIL_FROM: 'onboarding@resend.dev' }, { MAIL_FROM: 'local@tracelab.test' }, { MAIL_FROM: 'Name\r\nBCC: other@example.org' }]) {
    assert.ok(failed({ ...env, ...overrides }).includes('mail.production'));
  }
});
test('results never serialize configured credentials or key values', () => {
  const env = configured(), output = JSON.stringify(pilotEnvironmentChecks(env));
  for (const secret of [env.DATABASE_URL, env.SECRETS_ENCRYPTION_KEY, env.CRON_SECRET, env.RESEND_API_KEY, env.SUPABASE_SERVICE_ROLE_KEY]) assert.ok(!output.includes(secret));
});
test('local storage is explicitly manual and unknown storage fails', () => {
  assert.ok(pilotEnvironmentChecks({ ...configured(), STORAGE_PROVIDER: 'local', STORAGE_ROOT: '/private/volume' }).some(check => check.id === 'storage.persistence' && check.status === 'manual'));
  assert.ok(failed({ ...configured(), STORAGE_PROVIDER: 'public' }).includes('storage.configuration'));
});
test('migration grants require the real validated role for pooled connection usernames', () => {
  assert.equal(databaseRuntimeRole('postgresql://tracelab_runtime:secret@localhost/database'), 'tracelab_runtime');
  assert.equal(databaseRuntimeRole('postgresql://tracelab_runtime.projectref:secret@pool.example.org/database', 'tracelab_runtime'), 'tracelab_runtime');
  assert.throws(() => databaseRuntimeRole('postgresql://tracelab_runtime.projectref:secret@pool.example.org/database'));
  for (const role of ['runtime"; DROP TABLE users; --', 'postgres.role', 'runtime role', '../runtime']) {
    assert.throws(() => databaseRuntimeRole('postgresql://runtime:secret@localhost/database', role));
  }
  assert.throws(() => databaseRuntimeRole('https://runtime:secret@example.org/database'));
});

test('trusted proxy configuration rejects invalid hop counts rather than trusting a spoofable prefix',()=>{
  for(const hops of ['0','6','1.5','invalid'])assert.ok(failed({...configured(),TRUST_PROXY:'true',TRUST_PROXY_HOPS:hops}).includes('proxy.hops'));
  assert.ok(!failed({...configured(),TRUST_PROXY:'true',TRUST_PROXY_HOPS:'1'}).includes('proxy.hops'));
});
