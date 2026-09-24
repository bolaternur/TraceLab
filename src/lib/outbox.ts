/** IndexedDB outbox for offline captures. Stable client IDs make server sync idempotent. */
export interface OutboxItem {
  clientId: string;
  teamId: string;
  createdAt: string; // original local timestamp, preserved as fields.occurredAt
  fields: Record<string, string>;
  photo: { name: string; type: string; dataBase64: string } | null;
  status: "pending" | "syncing" | "failed";
  syncStartedAt?: string;
  error?: string;
  attempts: number;
}

const DB_NAME = "project-trace";
const STORE = "outbox";
export const SYNC_STALE_AFTER_MS = 60_000;

export const SYNC_BATCH_MAX_ITEMS = 8;
export const SYNC_BATCH_MAX_BYTES = 8 * 1024 * 1024;

function estimatedSyncBytes(item: Pick<OutboxItem, "clientId" | "teamId" | "fields" | "photo">): number {
  const fieldsBytes = JSON.stringify(item.fields).length;
  const photoBytes = item.photo ? item.photo.dataBase64.length + item.photo.name.length + item.photo.type.length : 0;
  return fieldsBytes + photoBytes + item.clientId.length + item.teamId.length + 256;
}

/** Partition offline evidence into bounded requests so reconnecting after a workshop does not create one huge JSON body. */
export function partitionSyncBatches(items: OutboxItem[], maxItems = SYNC_BATCH_MAX_ITEMS, maxBytes = SYNC_BATCH_MAX_BYTES): OutboxItem[][] {
  const batches: OutboxItem[][] = [];
  let current: OutboxItem[] = [];
  let currentBytes = 0;
  for (const item of items) {
    const size = estimatedSyncBytes(item);
    if (current.length && (current.length >= maxItems || currentBytes + size > maxBytes)) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

export function isSyncCandidate(item: Pick<OutboxItem, "status" | "syncStartedAt">, now = Date.now(), staleAfterMs = SYNC_STALE_AFTER_MS): boolean {
  if (item.status !== "syncing") return true;
  if (!item.syncStartedAt) return true;
  const startedAt = Date.parse(item.syncStartedAt);
  if (!Number.isFinite(startedAt)) return true;
  return now - startedAt >= staleAfterMs;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "clientId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const outbox = {
  async add(item: OutboxItem) {
    await tx("readwrite", (s) => s.put(item));
  },
  async all(): Promise<OutboxItem[]> {
    return tx("readonly", (s) => s.getAll() as IDBRequest<OutboxItem[]>);
  },
  async remove(clientId: string) {
    await tx("readwrite", (s) => s.delete(clientId));
  },
  async update(item: OutboxItem) {
    await tx("readwrite", (s) => s.put(item));
  },
};

export function newClientId() {
  const rnd = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `cap_${rnd}`;
}

/** Sync pending items. Returns counts. Safe to call repeatedly — server dedupes on teamId + clientId. */
export async function syncOutbox(): Promise<{ synced: number; failed: number; remaining: number }> {
  const now = Date.now();
  const items = (await outbox.all()).filter((item) => isSyncCandidate(item, now));
  if (items.length === 0) return { synced: 0, failed: 0, remaining: (await outbox.all()).length };

  let synced = 0, failed = 0;
  for (const batch of partitionSyncBatches(items)) {
    const syncStartedAt = new Date(now).toISOString();
    for (const item of batch) await outbox.update({ ...item, status: "syncing", syncStartedAt });
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: batch.map(({ clientId, teamId, fields, photo }) => ({ clientId, teamId, fields, photo })) }),
      });
      if (!res.ok) throw new Error(`sync ${res.status}`);
      const json = (await res.json()) as { results: Array<{ clientId: string; status: string; error?: string }> };
      const seen = new Set<string>();
      for (const result of json.results) {
        const item = batch.find((candidate) => candidate.clientId === result.clientId);
        if (!item) continue;
        seen.add(result.clientId);
        if (result.status === "synced" || result.status === "duplicate") {
          await outbox.remove(result.clientId);
          synced++;
        } else {
          failed++;
          await outbox.update({ ...item, status: "failed", syncStartedAt: undefined, error: result.error, attempts: item.attempts + 1 });
        }
      }
      for (const item of batch) {
        if (seen.has(item.clientId)) continue;
        failed++;
        await outbox.update({ ...item, status: "pending", syncStartedAt: undefined, error: "sync response missing item", attempts: item.attempts + 1 });
      }
    } catch (err) {
      for (const item of batch) await outbox.update({ ...item, status: "pending", syncStartedAt: undefined, error: String(err), attempts: item.attempts + 1 });
      failed += batch.length;
    }
  }
  const remaining = (await outbox.all()).length;
  return { synced, failed, remaining };
}

/** Re-encode via canvas: bakes orientation, drops EXIF/GPS client-side, and compresses for school networks. */
export async function prepareImage(file: File, maxEdge = 1600, quality = 0.82): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const c = canvas.getContext("2d");
    if (!c) return file;
    c.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}
