import test from 'node:test';
import assert from 'node:assert/strict';
import { productionEnvironment, migrationEnvironment } from '../scripts/production-environment.mjs';
import { applyPublicIndexMetadata, searchIndexPolicy } from '../scripts/search-index-policy.mjs';
import { dispatchAccountMail } from '../scripts/dispatch-account-mail.mjs';

const runtime = () => ({ NODE_ENV: 'production', RENDER_EXTERNAL_URL: 'https://iznera.onrender.com', PORT: '10000',
  DATABASE_URL: 'postgresql://tracelab_runtime.projectref:test-password@aws-0-eu.pooler.supabase.com:5432/postgres?sslmode=verify-full',
  DATABASE_RUNTIME_ROLE: 'tracelab_runtime', SUPABASE_URL: 'https://projectref.supabase.co', STORAGE_PROVIDER: 'supabase', TRUST_PROXY: 'true' });

test('Render origin and port normalize without inventing credentials', () => {
  const actual = productionEnvironment(runtime());
  assert.deepEqual(actual.failures, []);
  assert.equal(actual.env.APP_URL, runtime().RENDER_EXTERNAL_URL);
  assert.equal(actual.port, 10000);
});
test('production refuses owner secrets, weak TLS, ephemeral storage and malformed port', () => {
  for (const overrides of [{ DATABASE_MIGRATION_URL: 'present' }, { DATABASE_URL: runtime().DATABASE_URL.replace('verify-full', 'require') },
    { NODE_TLS_REJECT_UNAUTHORIZED: '0' }, { STORAGE_PROVIDER: 'local' }, { PORT: '10000junk' }, { APP_URL: 'https://wrong.example/path' }]) {
    assert.ok(productionEnvironment({ ...runtime(), ...overrides }).failures.length);
  }
});
test('ambiguous TLS parameters cannot disagree with the PostgreSQL driver parser', () => {
  for (const suffix of ['&sslmode=no-verify', '&sslmode=verify-full', '&ssl=0', '#fragment']) {
    const result = productionEnvironment({ ...runtime(), DATABASE_URL: runtime().DATABASE_URL + suffix });
    assert.ok(result.failures.includes('DATABASE_URL_requires_verified_TLS'));
  }
  assert.ok(productionEnvironment({ ...runtime(), DATABASE_URL: runtime().DATABASE_URL.replace('tracelab_runtime', '%XX') }).failures.length);
});
test('migration preflight distinguishes owner/runtime and rejects a different Supabase project', () => {
  const env = { ...runtime(), DATABASE_MIGRATION_URL: 'postgresql://postgres:test-password@db.projectref.supabase.co:5432/postgres?sslmode=verify-full' };
  assert.deepEqual(migrationEnvironment(env), []);
  assert.ok(migrationEnvironment({ ...env, DATABASE_MIGRATION_URL: env.DATABASE_URL }).length);
  assert.ok(migrationEnvironment({ ...env, DATABASE_MIGRATION_URL: env.DATABASE_MIGRATION_URL.replace('db.projectref', 'db.otherref') }).length);
  assert.ok(migrationEnvironment({ ...env, DATABASE_URL: env.DATABASE_URL.replace(':5432', ':6543') }).length);
});
test('only explicitly enabled public pages receive indexing metadata', () => {
  const html = '<head><meta name="robots" content="noindex,nofollow"></head>';
  const env = { ...runtime(), INDEX_PUBLIC_SITE: 'true' };
  assert.deepEqual(searchIndexPolicy(runtime()).paths, []);
  assert.equal(applyPublicIndexMetadata(html, '/', runtime()), html);
  assert.match(applyPublicIndexMetadata(html, '/', env), /content="index,follow"/);
  assert.match(applyPublicIndexMetadata(html, '/', env), /href="https:\/\/iznera.onrender.com\/"/);
  for (const path of ['/workspace', '/demo', '/auth', '/research', '/materials', '/_presentation/index.html']) {
    assert.equal(applyPublicIndexMetadata(html, path, env), html);
    assert.ok(!searchIndexPolicy(env).paths.includes(path));
  }
  assert.deepEqual(searchIndexPolicy({ ...env, APP_URL: 'http://localhost:3000' }).paths, []);
});
test('scheduler fails on unsuccessful dispatch and returns only counters', async () => {
  const env = { APP_URL: 'https://iznera.onrender.com', CRON_SECRET: 'unit-test-only-secret-longer-than-32-characters' };
  let options;
  const result = await dispatchAccountMail(env, async (_url, request) => { options = request; return Response.json({ ok: true, processed: 2, sent: 2, failed: 0, exhausted: 0, privateData: 'must-not-escape' }); });
  assert.deepEqual(result, { processed: 2, sent: 2, failed: 0, exhausted: 0 });
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, `Bearer ${env.CRON_SECRET}`);
  await assert.rejects(dispatchAccountMail(env, async () => Response.json({ ok: false }, { status: 503 })));
});
