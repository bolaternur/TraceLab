import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private object storage adapter. Local-disk implementation for this environment;
 * the interface is what an S3/Supabase adapter would implement.
 */
export interface StorageAdapter {
  put(key: string, bytes: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

const ROOT = process.env.STORAGE_ROOT ?? path.join(process.cwd(), ".data", "storage");

class LocalDiskStorage implements StorageAdapter {
  async put(key: string, bytes: Buffer) {
    const file = path.join(ROOT, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes);
  }
  async get(key: string) {
    try {
      return await readFile(path.join(ROOT, key));
    } catch {
      return null;
    }
  }
}

export const storage: StorageAdapter = new LocalDiskStorage();

export const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const ALLOWED_UPLOAD_TYPES = new Set([...ALLOWED_IMAGE_TYPES, "text/csv", "application/pdf", "video/mp4"]);
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export function sha256(bytes: Buffer | string) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Detect real content type from magic bytes; never trust the client-provided header alone. */
export function sniffContentType(bytes: Buffer): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") return "video/mp4";
  return null;
}

/**
 * Strip EXIF/XMP/ICC application segments from a JPEG (removes GPS + device metadata).
 * Orientation is normalised client-side before upload (canvas re-encode), so dropping APP1 is safe.
 */
export function stripJpegMetadata(bytes: Buffer): Buffer {
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8)) return bytes;
  const out: Buffer[] = [Buffer.from([0xff, 0xd8])];
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1];
    if (marker === 0xda) {
      out.push(bytes.subarray(i));
      break;
    }
    const len = bytes.readUInt16BE(i + 2);
    const segment = bytes.subarray(i, i + 2 + len);
    const isApp = marker >= 0xe1 && marker <= 0xef; // APP1..APP15 (EXIF, XMP, ICC etc.)
    if (!isApp) out.push(segment);
    i += 2 + len;
  }
  return Buffer.concat(out);
}

// ---------------------------------------------------------------------------
// Connector secret encryption (AES-256-GCM). Key from env; dev fallback is derived and flagged.
// ---------------------------------------------------------------------------
function secretKey(): Buffer {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (raw && raw.length >= 32) return createHash("sha256").update(raw).digest();
  if (process.env.NODE_ENV === "production") {
    throw new Error("SECRETS_ENCRYPTION_KEY must be configured with at least 32 characters in production");
  }
  return createHash("sha256").update("dev-only-insecure-key-set-SECRETS_ENCRYPTION_KEY").digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${enc.toString("base64url")}`;
}

export function decryptSecret(token: string): string {
  const [v, iv, tag, data] = token.split(".");
  if (v !== "v1") throw new Error("Unsupported secret format");
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function newStorageKey(teamId: string, ext: string) {
  return `${teamId}/${new Date().toISOString().slice(0, 10)}/${randomBytes(12).toString("hex")}.${ext}`;
}
