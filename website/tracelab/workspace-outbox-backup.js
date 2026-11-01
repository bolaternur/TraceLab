import { OUTBOX_LIMITS } from './workspace-outbox.js';

const table = Uint32Array.from({ length: 256 }, (_, byte) => { let crc = byte; for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1; return crc >>> 0; });
export function crc32(bytes, initial = 0) { let crc = initial ^ 0xffffffff; for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
async function blobCrc(blob) { let crc = 0; const reader = blob.stream().getReader(); try { for (;;) { const { done, value } = await reader.read(); if (done) return crc; crc = crc32(value, crc); } } finally { reader.releaseLock(); } }
function header(size) { const bytes = new Uint8Array(size); return { bytes, view: new DataView(bytes.buffer) }; }

/** ZIP STORE keeps original queued photo bytes and readable metadata, without an archive dependency. */
export async function createOfflineBackup(rows, { userId, createdAt = new Date().toISOString() } = {}) {
  if (!userId || !Array.isArray(rows) || rows.some(row => row.userId !== userId)) throw Object.assign(new Error('Backup owner mismatch'), { code: 'owner_mismatch' });
  if (rows.length > OUTBOX_LIMITS.records) throw new Error('backup_limit');
  let photoBytes = 0;
  const files = [], entries = [];
  for (const [index, row] of rows.entries()) {
    const common = { id: row.id, userId, teamId: row.teamId, projectId: row.projectId, createdAt: row.createdAt, state: row.state, attempts: row.attempts ?? 0 };
    if (row.type === 'photo') {
      if (!(row.blob instanceof Blob) || !row.blob.size || row.blob.size > OUTBOX_LIMITS.photoBytes) throw new Error('backup_photo_unavailable');
      photoBytes += row.blob.size; if (photoBytes > OUTBOX_LIMITS.pendingPhotoBytes) throw new Error('backup_limit');
      const extension = /\.webp$/i.test(row.metadata?.filename) ? 'webp' : /\.png$/i.test(row.metadata?.filename) ? 'png' : 'jpg';
      const path = `photos/photo-${String(index + 1).padStart(3, '0')}.${extension}`;
      files.push({ name: path, blob: row.blob }); entries.push({ ...common, type: 'photo', metadata: row.metadata, path, sizeBytes: row.blob.size, filesIncluded: true });
    } else entries.push({ ...common, type: 'record', record: row.record });
  }
  const manifest = { format: 'iznera-offline-backup-v1', createdAt, ownerUserId: userId, containsPrivateData: true,
    restore: 'Extract this ZIP to recover the original queued photos and the text in manifest.json. This is a device-draft backup, not a full team backup or automatic import. Reconnect only as the original owner and review existing team records before re-uploading.', entries };
  const manifestBlob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  if (manifestBlob.size > 4 * 1024 * 1024) throw new Error('backup_limit');
  files.unshift({ name: 'manifest.json', blob: manifestBlob });
  const local = [], central = []; let offset = 0, centralSize = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name), crc = await blobCrc(file.blob), item = header(30), directory = header(46);
    item.view.setUint32(0, 0x04034b50, true); item.view.setUint16(4, 20, true); item.view.setUint16(6, 0x800, true); item.view.setUint16(12, 33, true);
    item.view.setUint32(14, crc, true); item.view.setUint32(18, file.blob.size, true); item.view.setUint32(22, file.blob.size, true); item.view.setUint16(26, name.length, true);
    directory.view.setUint32(0, 0x02014b50, true); directory.view.setUint16(4, 20, true); directory.view.setUint16(6, 20, true); directory.view.setUint16(8, 0x800, true); directory.view.setUint16(14, 33, true);
    directory.view.setUint32(16, crc, true); directory.view.setUint32(20, file.blob.size, true); directory.view.setUint32(24, file.blob.size, true); directory.view.setUint16(28, name.length, true); directory.view.setUint32(42, offset, true);
    local.push(item.bytes, name, file.blob); central.push(directory.bytes, name); offset += 30 + name.length + file.blob.size; centralSize += 46 + name.length;
  }
  const end = header(22); end.view.setUint32(0, 0x06054b50, true); end.view.setUint16(8, files.length, true); end.view.setUint16(10, files.length, true); end.view.setUint32(12, centralSize, true); end.view.setUint32(16, offset, true);
  return new Blob([...local, ...central, end.bytes], { type: 'application/zip' });
}

export async function downloadOfflineBackup(rows, userId) {
  const blob = await createOfflineBackup(rows, { userId }), href = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = href; link.download = `iznera-offline-backup-${new Date().toISOString().slice(0, 10)}.zip`; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 30000); return rows.length;
}
