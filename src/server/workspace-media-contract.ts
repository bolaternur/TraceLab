import { createHash } from "node:crypto";
import { z } from "zod";

export const MEDIA_LIMITS = Object.freeze({ imageBytes: 15 * 1024 * 1024, documentBytes: 10 * 1024 * 1024,
  videoBytes: 30 * 1024 * 1024, modelBytes: 25 * 1024 * 1024, teamBytes: 500 * 1024 * 1024,
  imagePixels: 24_000_000, imageSide: 8192, textureSide: 4096, texturePixels: 16_000_000,
  nodes: 2000, meshes: 300, accessors: 5000, vertices: 2_000_000, triangles: 1_000_000,
  geometryBytes: 64 * 1024 * 1024, textures: 32, uploadsPerMinute: 12 });

export class MediaError extends Error {
  constructor(public code: string, public status = 422) { super(code); this.name = "MediaError"; }
}
const text = (max: number) => z.string().trim().max(max).refine(value => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value));
export const uploadMetadata = z.object({
  teamId: z.string().uuid(), projectId: z.string().uuid(), requestId: z.string().uuid(),
  name: text(160).min(1), filename: text(180).min(1), caption: text(5000).default(""), alt: text(500).default(""),
  kind: z.enum(["photo", "drawing", "render", "document", "video", "model"]),
  occurredAt: z.string().datetime({ offset: true }), subsystemId: z.string().uuid().optional(),
  model: z.object({ category: z.enum(["robot", "assembly", "part"]), versionLabel: text(80).min(1),
    tags: z.array(text(40).min(1)).max(20).default([]), previousModelId: z.string().uuid().optional() }).strict().optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.kind === "model") !== Boolean(value.model)) ctx.addIssue({ code: "custom", message: "Model metadata is required only for a model." });
});
export type UploadMetadata = z.infer<typeof uploadMetadata>;
export function parseUploadMetadata(header: string | null): UploadMetadata {
  if (!header || header.length > 30_000) throw new MediaError("invalid_metadata");
  try { return uploadMetadata.parse(JSON.parse(decodeURIComponent(header))); }
  catch { throw new MediaError("invalid_metadata"); }
}
export function uploadLimit(kind: UploadMetadata["kind"]) {
  return kind === "model" ? MEDIA_LIMITS.modelBytes : kind === "video" ? MEDIA_LIMITS.videoBytes
    : kind === "document" ? MEDIA_LIMITS.documentBytes : MEDIA_LIMITS.imageBytes;
}
export function mediaHash(bytes: Buffer | string) { return createHash("sha256").update(bytes).digest("hex"); }
export function uploadFingerprint(input: UploadMetadata, bytes: Buffer) {
  // Schema parsing gives a stable, fixed field order. Identity is the complete payload, not only its name.
  return mediaHash(JSON.stringify(uploadMetadata.parse(input)) + ":" + mediaHash(bytes));
}
export async function readUploadBytes(request: Request, limit: number): Promise<Buffer> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new MediaError("file_too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new MediaError("empty_file");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (request.signal.aborted) throw new MediaError("upload_cancelled", 499);
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new MediaError("file_too_large", 413); }
      chunks.push(chunk.value);
    }
    if (!size) throw new MediaError("empty_file");
    if (declared && Number(declared) !== size) throw new MediaError("incomplete_file");
    return Buffer.concat(chunks, size);
  } finally { reader.releaseLock(); }
}

type Json = Record<string, unknown>;
const object = (value: unknown): Json => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MediaError("invalid_glb");
  return value as Json;
};
const array = (value: unknown, maximum: number): unknown[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maximum) throw new MediaError("model_budget_exceeded");
  return value;
};
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) throw new MediaError("invalid_glb");
  return value;
};
const at = (items: unknown[], index: unknown) => object(items[integer(index, 0, items.length - 1)]);
const bytesPerComponent: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const components: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
const supportedExtensions = new Set(["KHR_materials_unlit", "KHR_texture_transform"]);
export type GlbInspection = { json: Json; binary: Buffer; vertices: number; triangles: number;
  images: Array<{ bytes: Buffer; mimeType: "image/jpeg" | "image/png" }> };

/** Bounded, self-contained GLB v2 only. Remote, data and local resource URIs are all refused. */
export function inspectGlb(bytes: Buffer): GlbInspection {
  if (bytes.length < 28 || bytes.length > MEDIA_LIMITS.modelBytes || bytes.toString("ascii", 0, 4) !== "glTF"
    || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new MediaError("invalid_glb");
  const jsonLength = bytes.readUInt32LE(12);
  if (!jsonLength || jsonLength % 4 || jsonLength > 2_000_000 || jsonLength + 28 > bytes.length
    || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new MediaError("invalid_glb");
  let json: Json;
  try { json = object(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(20, 20 + jsonLength)))); }
  catch { throw new MediaError("invalid_glb"); }
  const binOffset = 20 + jsonLength;
  const binLength = bytes.readUInt32LE(binOffset);
  if (binLength % 4 || bytes.readUInt32LE(binOffset + 4) !== 0x004e4942 || binOffset + 8 + binLength !== bytes.length)
    throw new MediaError("invalid_glb");
  const binary = bytes.subarray(binOffset + 8);
  let visits = 0;
  function walk(value: unknown, depth = 0) {
    if (++visits > 100_000 || depth > 50) throw new MediaError("model_budget_exceeded");
    if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > 1e12)) throw new MediaError("invalid_glb");
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(item => walk(item, depth + 1)); return; }
    for (const [key, item] of Object.entries(value)) {
      if (key === "uri" || key === "url") throw new MediaError("model_external_resource");
      if (key === "extensions" && Object.keys(object(item)).some(name => !supportedExtensions.has(name))) throw new MediaError("model_unsupported_feature");
      walk(item, depth + 1);
    }
  }
  walk(json);
  if (object(json.asset).version !== "2.0") throw new MediaError("invalid_glb");
  for (const name of [...array(json.extensionsRequired, 10), ...array(json.extensionsUsed, 10)])
    if (typeof name !== "string" || !supportedExtensions.has(name)) throw new MediaError("model_unsupported_feature");
  if (array(json.animations, 100).length || array(json.skins, 100).length) throw new MediaError("model_unsupported_feature");
  const buffers = array(json.buffers, 1);
  if (buffers.length !== 1) throw new MediaError("invalid_glb");
  const byteLength = integer(object(buffers[0]).byteLength, 1, binary.length);
  if (binary.length - byteLength > 3) throw new MediaError("invalid_glb");
  const views = array(json.bufferViews, 10000);
  for (const value of views) {
    const view = object(value);
    if (view.buffer !== 0) throw new MediaError("invalid_glb");
    const start = integer(view.byteOffset ?? 0);
    integer(view.byteLength, 1, byteLength - start);
    if (view.byteStride !== undefined && (integer(view.byteStride, 4, 252) % 4)) throw new MediaError("invalid_glb");
  }
  const accessors = array(json.accessors, MEDIA_LIMITS.accessors);
  let decodedBytes = 0;
  for (const value of accessors) {
    const accessor = object(value);
    if (accessor.sparse !== undefined) throw new MediaError("model_unsupported_feature");
    const view = at(views, accessor.bufferView);
    const bytesPer = bytesPerComponent[integer(accessor.componentType)];
    const arity = components[String(accessor.type)];
    if (!bytesPer || !arity) throw new MediaError("invalid_glb");
    const count = integer(accessor.count, 1, MEDIA_LIMITS.vertices * 3);
    const width = bytesPer * arity;
    const stride = integer(view.byteStride ?? width, width, 252);
    const offset = integer(accessor.byteOffset ?? 0);
    if (offset % bytesPer || (count - 1) * stride + width + offset > Number(view.byteLength)) throw new MediaError("invalid_glb");
    decodedBytes += count * width;
    if (decodedBytes > MEDIA_LIMITS.geometryBytes) throw new MediaError("model_budget_exceeded");
  }
  const meshes = array(json.meshes, MEDIA_LIMITS.meshes);
  const meshCosts = meshes.map(value => {
    let vertices = 0, triangles = 0;
    for (const item of array(object(value).primitives, 300)) {
      const primitive = object(item), attrs = object(primitive.attributes);
      if (primitive.mode !== undefined && primitive.mode !== 4) throw new MediaError("model_unsupported_feature");
      if (primitive.targets !== undefined) throw new MediaError("model_unsupported_feature");
      const position = at(accessors, attrs.POSITION);
      if (position.type !== "VEC3" || position.componentType !== 5126) throw new MediaError("invalid_glb");
      for (const index of Object.values(attrs)) at(accessors, index);
      const count = Number(position.count);
      const view = at(views, position.bufferView);
      const stride = Number(view.byteStride ?? 12), start = Number(view.byteOffset ?? 0) + Number(position.byteOffset ?? 0);
      for (let i = 0; i < count; i++) for (let axis = 0; axis < 3; axis++) {
        const coordinate = binary.readFloatLE(start + i * stride + axis * 4);
        if (!Number.isFinite(coordinate) || Math.abs(coordinate) > 1e8) throw new MediaError("invalid_glb");
      }
      let indices = count;
      if (primitive.indices !== undefined) {
        const indexAccessor = at(accessors, primitive.indices);
        if (indexAccessor.type !== "SCALAR" || ![5121,5123,5125].includes(Number(indexAccessor.componentType))) throw new MediaError("invalid_glb");
        indices = Number(indexAccessor.count);
        const iv = at(views, indexAccessor.bufferView), width = bytesPerComponent[Number(indexAccessor.componentType)];
        const indexStart = Number(iv.byteOffset ?? 0) + Number(indexAccessor.byteOffset ?? 0), indexStride = Number(iv.byteStride ?? width);
        for (let i = 0; i < indices; i++) if (binary.readUIntLE(indexStart + i * indexStride, width) >= count) throw new MediaError("invalid_glb");
      }
      if (indices % 3) throw new MediaError("invalid_glb");
      vertices += count; triangles += indices / 3;
    }
    return { vertices, triangles };
  });
  const nodes = array(json.nodes, MEDIA_LIMITS.nodes), parents = new Set<number>();
  let vertices = 0, triangles = 0;
  nodes.forEach(value => {
    const node = object(value);
    if (node.mesh !== undefined) {
      const cost = meshCosts[integer(node.mesh, 0, meshes.length - 1)];
      vertices += cost.vertices; triangles += cost.triangles;
    }
    for (const child of array(node.children, MEDIA_LIMITS.nodes)) {
      const index = integer(child, 0, nodes.length - 1);
      if (parents.has(index)) throw new MediaError("invalid_glb");
      parents.add(index);
    }
  });
  const seen = new Set<number>();
  function visit(index: number, ancestors: Set<number>) {
    if (ancestors.has(index)) throw new MediaError("invalid_glb");
    if (seen.has(index)) return;
    if (ancestors.size > 128) throw new MediaError("model_budget_exceeded");
    seen.add(index);
    const chain = new Set(ancestors).add(index);
    for (const child of array(object(nodes[index]).children, MEDIA_LIMITS.nodes)) visit(Number(child), chain);
  }
  nodes.forEach((_, index) => visit(index, new Set()));
  const scenes = array(json.scenes, 100);
  if (!scenes.length || !vertices || vertices > MEDIA_LIMITS.vertices || triangles > MEDIA_LIMITS.triangles) throw new MediaError("model_budget_exceeded");
  integer(json.scene ?? 0, 0, scenes.length - 1);
  scenes.forEach(value => array(object(value).nodes, MEDIA_LIMITS.nodes).forEach(index => {
    const root = integer(index, 0, nodes.length - 1);
    if (parents.has(root)) throw new MediaError("invalid_glb");
  }));
  const images = array(json.images, MEDIA_LIMITS.textures).map(value => {
    const image = object(value), view = at(views, image.bufferView);
    if (image.mimeType !== "image/png" && image.mimeType !== "image/jpeg") throw new MediaError("model_unsupported_feature");
    const offset = Number(view.byteOffset ?? 0);
    return { bytes: binary.subarray(offset, offset + Number(view.byteLength)), mimeType: image.mimeType as "image/jpeg" | "image/png" };
  });
  return { json, binary, vertices, triangles, images };
}
