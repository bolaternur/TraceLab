import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutbox } from './workspace-outbox.js';
import { createOfflineBackup, crc32 } from './workspace-outbox-backup.js';
import { finishOfflineSignout, offlineAccountCopy, prepareOfflineSignout } from './workspace-offline-account.js';

function memory() { const rows = new Map(); return { all: async () => [...rows.values()].map(value => structuredClone(value)), put: async value => rows.set(value.id, structuredClone(value)), remove: async id => rows.delete(id) }; }
const context = { userId: 'owner', teamId: 'team', projectId: 'project' };
function photo() { const blob = new Blob([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4])], { type: 'image/png' }); Object.defineProperty(blob, 'name', { value: '../../private.png' }); return blob; }
async function extract(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()), view = new DataView(bytes.buffer), files = new Map(); let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true), length = view.getUint16(offset + 26, true), extra = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + length)), start = offset + 30 + length + extra, content = bytes.slice(start, start + size);
    assert.equal(view.getUint16(offset + 8, true), 0); assert.equal(crc32(content), view.getUint32(offset + 14, true)); files.set(name, content); offset = start + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50); assert.equal(view.getUint32(bytes.length - 22, true), 0x06054b50); assert.equal(view.getUint16(bytes.length - 12, true), files.size);
  return files;
}

test('CRC32 is incremental and uses the standard ZIP checksum', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  assert.equal(crc32(new TextEncoder().encode('56789'), crc32(new TextEncoder().encode('1234'))), 0xcbf43926);
});
test('complete draft ZIP includes exact image bytes, authored text and ownership; filenames cannot escape the archive', async () => {
  const box = createOutbox({ storage: memory() }), original = photo();
  await box.enqueue(context, { kind: 'source', title: 'Авторский текст', body: 'Точные слова ученика' });
  await box.enqueuePhoto(context, { file: original, title: 'Фото', caption: 'Подпись', occurredAt: '2026-10-31T13:04:05Z' });
  const files = await extract(await createOfflineBackup(await box.list(context.userId), { userId: context.userId, createdAt: '2026-11-01T00:00:00Z' }));
  assert.equal(files.size, 2); const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
  assert.equal(manifest.ownerUserId, context.userId); assert.equal(manifest.containsPrivateData, true);
  assert.equal(manifest.entries[0].record.body, 'Точные слова ученика');
  const image = manifest.entries.find(entry => entry.type === 'photo'); assert.equal(image.filesIncluded, true); assert.equal(image.metadata.occurredAt, '2026-10-31T13:04:05.000Z');
  assert.ok(image.path.startsWith('photos/photo-')); assert.ok(!image.path.includes('..')); assert.deepEqual(files.get(image.path), new Uint8Array(await original.arrayBuffer()));
  assert.equal((await box.list(context.userId)).length, 2);
});
test('backup denies mixed owners and missing photo blobs instead of making an incomplete archive', async () => {
  await assert.rejects(createOfflineBackup([{ userId: 'other' }], { userId: 'owner' }), { code: 'owner_mismatch' });
  await assert.rejects(createOfflineBackup([{ userId: 'owner', type: 'photo', metadata: {}, blob: null }], { userId: 'owner' }), /backup_photo_unavailable/);
});
test('signout keeps drafts by default, clears active context and never contacts sync endpoints', async () => {
  let clear = 0; const box = createOutbox({ storage: memory(), request: () => { throw new Error('no network allowed'); } });
  await box.enqueue(context, { kind: 'source', title: 'Draft' });
  assert.equal(await finishOfflineSignout({ userId: context.userId, choice: 'keep' }, { box, clearContext: async () => { clear++; } }), 0);
  assert.equal(clear, 1); assert.equal((await box.list(context.userId)).length, 1);
});
test('explicit local discard deletes only the current owner and serializes with the owner queue', async () => {
  const storage = memory(), box = createOutbox({ storage });
  await box.enqueue(context, { kind: 'source', title: 'Mine' }); await box.enqueue({ ...context, userId: 'other' }, { kind: 'source', title: 'Other account' });
  let cleared = false;
  const count = await finishOfflineSignout({ userId: 'owner', choice: 'discard' }, { box, clearContext: async () => { cleared = true; } });
  assert.equal(cleared, true); assert.equal(count, 1); assert.equal((await box.list('owner')).length, 0); assert.equal((await box.list('other')).length, 1);
  await assert.rejects(box.discardAll(''), { code: 'no_context' });
});
test('empty queues need no interrupting dialog; all three locales explain private complete backup and permanent local deletion', async () => {
  assert.deepEqual(await prepareOfflineSignout({ userId: 'owner' }, { box: createOutbox({ storage: memory() }) }), { choice: 'keep', count: 0 });
  for (const locale of ['ru', 'en', 'kk']) for (const key of ['title', 'owner', 'backup', 'backupHint', 'downloaded', 'keep', 'discard', 'confirm', 'unavailable']) assert.ok(offlineAccountCopy[locale][key]);
});
