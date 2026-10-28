import { storage, type StorageAdapter } from "./storage";
import { MediaError } from "./workspace-media-contract";

function keyPath(key: string) {
  if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)+$/.test(key) || key.split("/").some(part => part === "." || part === ".."))
    throw new MediaError("invalid_storage_key");
  return key.split("/").map(encodeURIComponent).join("/");
}

/** Optional private Supabase adapter. No public URL or browser credential is exposed. */
export class PrivateSupabaseStorage implements StorageAdapter {
  private base: string;
  private headers: Record<string,string>;
  constructor(url: string, serviceKey: string, private bucket: string, private transport: typeof fetch = fetch) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.search || parsed.hash
      || parsed.pathname !== "/" || !/^[a-zA-Z0-9_-]+$/.test(bucket) || !serviceKey) throw new MediaError("storage_not_configured", 503);
    this.base = parsed.origin + "/storage/v1";
    this.headers = { apikey: serviceKey, Authorization: "Bearer " + serviceKey };
  }
  private async request(path: string, options: RequestInit = {}) {
    return this.transport(this.base + path, { ...options, headers: { ...this.headers, ...options.headers },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60_000) });
  }
  private async assertPrivate() {
    const response = await this.request("/bucket/" + encodeURIComponent(this.bucket));
    if (!response.ok) throw new MediaError("storage_unavailable", 503);
    const bucket = await response.json() as { public?: boolean };
    if (bucket.public !== false) throw new MediaError("private_bucket_required", 503);
  }
  async put(key: string, bytes: Buffer, contentType: string) {
    const safe = keyPath(key);
    await this.assertPrivate();
    const response = await this.request("/object/" + this.bucket + "/" + safe,
      { method: "POST", body: new Uint8Array(bytes), headers: { "Content-Type": contentType, "x-upsert": "false" } });
    if (!response.ok) throw new MediaError("storage_unavailable", 503);
  }
  async get(key: string) {
    const safe = keyPath(key);
    await this.assertPrivate();
    const response = await this.request("/object/authenticated/" + this.bucket + "/" + safe);
    if (response.status === 404) return null;
    if (!response.ok) throw new MediaError("storage_unavailable", 503);
    return Buffer.from(await response.arrayBuffer());
  }
  async delete(key: string) {
    const safe = keyPath(key);
    const response = await this.request("/object/" + this.bucket, { method: "DELETE", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ prefixes: [safe] }) });
    if (!response.ok && response.status !== 404) throw new MediaError("storage_unavailable", 503);
  }
  async deletePrefix(): Promise<void> { throw new MediaError("bulk_delete_requires_review", 403); }
}

let configured: StorageAdapter | undefined;
function adapter(): StorageAdapter {
  if (configured) return configured;
  const provider = process.env.STORAGE_PROVIDER || "local";
  if (provider === "local") return configured = storage;
  if (provider !== "supabase") throw new MediaError("storage_not_configured", 503);
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, SUPABASE_STORAGE_BUCKET: bucket } = process.env;
  if (!url || !key || !bucket) throw new MediaError("storage_not_configured", 503);
  return configured = new PrivateSupabaseStorage(url,key,bucket);
}
export const mediaStorage: StorageAdapter = {
  put: (key,bytes,type) => adapter().put(key,bytes,type),
  get: key => adapter().get(key), delete: key => adapter().delete(key),
  deletePrefix: () => Promise.reject(new MediaError("bulk_delete_requires_review",403)),
};
