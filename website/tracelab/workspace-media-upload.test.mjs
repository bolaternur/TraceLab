import test from 'node:test';
import assert from 'node:assert/strict';
import { createMediaUploadQueue, UPLOAD_QUEUE_LIMITS, uploadSelectionError } from './workspace-media-upload.js';
import { mediaMessages } from './workspace-media-copy.js';

const file = (name = 'photo.png', content = 'fixture') => new File([content], name, { type: name.endsWith('.csv') ? 'text/csv' : name.endsWith('.pdf') ? 'application/pdf' : 'image/png' });
const setup = (transport, extra = {}) => createMediaUploadQueue({ teamId: 'team-fixture', projectId: 'project-fixture', transport, ...extra });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('selection rejects bad files individually and enforces count, per-file and aggregate memory budgets', () => {
  const queue = setup(async () => ({}));
  const result = queue.add([file('one.png'), new File(['x'], 'script.exe'), file('two.csv')]);
  assert.equal(result.added.length, 2); assert.equal(result.rejected[0].code, 'unsupported_file');
  assert.equal(uploadSelectionError({ name: 'huge.png', type: 'image/png', size: UPLOAD_QUEUE_LIMITS.imageBytes + 1 }), 'file_too_large');
  assert.equal(uploadSelectionError({ name: 'empty.png', type: 'image/png', size: 0 }), 'empty_file');
  assert.equal(queue.add(Array.from({ length: 25 }, () => file())).added.length, 18);
  const memory = setup(async () => ({}));
  const large = { name: 'photo.png', type: 'image/png', size: 10 * 1024 * 1024 };
  assert.equal(memory.add(Array.from({ length: 15 }, () => large)).added.length, 10);
});

test('one failed file does not undo a saved file; retry preserves the exact bytes, time and idempotency metadata', async () => {
  const sent = []; let fail = true;
  const queue = setup(async (bytes, metadata) => { sent.push({ bytes, metadata }); if (metadata.name === 'one' && fail) throw new Error('lost acknowledgement'); return { artifactId: metadata.requestId }; });
  const [one, two] = queue.add([file('one.png'), file('two.png')]).added;
  await queue.start(); assert.equal(one.state, 'error'); assert.equal(two.state, 'saved');
  assert.equal(queue.update(one.id, { caption: 'different uncertain request' }), false);
  fail = false; await queue.retry(one.id);
  assert.equal(one.state, 'saved'); assert.equal(two.state, 'saved');
  assert.equal(sent[0].bytes, sent[2].bytes); assert.equal(sent[0].metadata, sent[2].metadata);
  assert.equal(sent[0].metadata.requestId, one.id); assert.equal(sent[0].metadata.occurredAt, one.occurredAt);
  assert.equal(sent.length, 3);
});

test('transfers are serial; cancelling one permits the next and reuses the cancelled request on retry', async () => {
  const calls = []; let active = 0, maximum = 0;
  const queue = setup((bytes, metadata, { signal }) => {
    active++; maximum = Math.max(maximum, active);
    return new Promise((resolve, reject) => { calls.push({ metadata, resolve: () => { active--; resolve({}); } }); signal.addEventListener('abort', () => { active--; reject(new Error('cancelled')); }, { once: true }); });
  });
  const [one, two] = queue.add([file('one.png'), file('two.png')]).added;
  const first = queue.start(); await tick(); assert.equal(calls.length, 1);
  queue.cancel(one.id); await tick(); assert.equal(one.state, 'cancelled'); assert.equal(calls.length, 2);
  calls[1].resolve(); await first; assert.equal(two.state, 'saved');
  const retry = queue.retry(one.id); await tick(); assert.equal(calls[2].metadata, calls[0].metadata);
  calls[2].resolve(); await retry; assert.equal(one.state, 'saved'); assert.equal(maximum, 1);
});

test('edited photos send only the replacement bytes with a labelled local edit; oversized replacements keep original unsubmitted', async () => {
  const sent = [], queue = setup(async (bytes, metadata) => { sent.push({ bytes, metadata }); return {}; });
  const original = file('private.png', 'private pixels'), entry = queue.add([original]).added[0], edited = file('private.png', 'redacted pixels');
  assert.equal(queue.replaceFile(entry.id, { name: 'huge.png', size: UPLOAD_QUEUE_LIMITS.imageBytes + 1, type: 'image/png' }), false);
  assert.equal(entry.file, original); assert.equal(sent.length, 0);
  assert.equal(queue.replaceFile(entry.id, edited), true); await queue.start();
  assert.equal(sent[0].bytes, edited); assert.notEqual(sent[0].bytes, original);
  assert.equal(sent[0].metadata.clientPrivacyEdit, 'local-crop-redaction');
  assert.equal(entry.file, null); assert.equal(entry.pending, null);
});

test('offline errors retain pending bytes, stop the automatic queue and retry without changing ownership', async () => {
  let online = false; const calls = [];
  const queue = setup(async (bytes, metadata) => { calls.push(metadata); if (!online) throw Object.assign(new Error('offline'), { code: 'offline' }); return {}; });
  const [one, two] = queue.add([file(), file('second.png')]).added;
  await queue.start(); assert.equal(one.state, 'error'); assert.equal(two.state, 'queued'); assert.equal(calls.length, 1);
  online = true; await queue.retry(one.id); assert.equal(one.state, 'saved'); assert.equal(two.state, 'saved');
  assert.equal(calls[1], calls[0]); assert.equal(calls[1].teamId, 'team-fixture');
});

test('disposing cancels active requests and clears private local references without new notifications', async () => {
  let changes = 0;
  const queue = setup((file, metadata, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })), { onChange: () => { changes++; } });
  const entry = queue.add([file()]).added[0], sending = queue.start(); await tick(); const before = changes;
  queue.dispose(); await sending; assert.equal(changes, before); assert.equal(entry.file, null); assert.equal(entry.pending, null);
});

test('queue states and local privacy instructions are available in RU, EN and KK', () => {
  for (const locale of ['ru', 'en', 'kk']) for (const key of ['batchUpload', 'batchHint', 'queueLimit', 'uploadSelected', 'selectedFile', 'queuedFile', 'filesSelected', 'filesSaved', 'cancelUpload', 'removeSelection', 'extraDetails', 'localEdited', 'editedTooLarge', 'queueCloseHint']) assert.ok(mediaMessages[locale][key]);
});
