import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('logout preserves only the public offline shell and never intercepts authenticated responses', async () => {
  const source = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8'), handlers = new Map(), deleted = [];
  const sandbox = { URL, Response, self: { location: { origin: 'https://example.test' }, addEventListener: (name, handler) => handlers.set(name, handler) }, caches: { keys: async () => ['iznera-public-v9', 'obsolete-private-cache'], delete: async key => { deleted.push(key); } } };
  vm.runInNewContext(source, sandbox);
  let clearing; handlers.get('message')({ data: 'clear-private-data', waitUntil: value => { clearing = value; } }); await clearing;
  assert.deepEqual(deleted, ['obsolete-private-cache']);
  for (const path of ['/api/workspace', '/auth?mode=signin', '/app/history', '/join/private-code']) {
    let intercepted = false; handlers.get('fetch')({ request: new Request('https://example.test' + path), respondWith: () => { intercepted = true; } }); assert.equal(intercepted, false);
  }
});

test('the public offline install includes the complete-backup dependencies', async () => {
  const source = await readFile(new URL('../../public/sw.js', import.meta.url), 'utf8'), handlers = new Map(); let shell;
  const sandbox = { self: { addEventListener: (name, handler) => handlers.set(name, handler), skipWaiting: () => {} }, caches: { open: async () => ({ addAll: async files => { shell = Array.from(files); } }) } };
  vm.runInNewContext(source, sandbox); let installing; handlers.get('install')({ waitUntil: value => { installing = value; } }); await installing;
  for (const path of ['/offline-capture.html', '/offline-capture.js', '/workspace-outbox.js', '/workspace-outbox-backup.js', '/offline-account.css']) assert.ok(shell.includes(path));
  assert.ok(!shell.some(path => path.startsWith('/api/') || path.startsWith('/auth') || path === '/workspace'));
});
