import sharp from "sharp";
import { inspectGlb, MEDIA_LIMITS, MediaError, mediaHash, uploadLimit, type UploadMetadata } from "./workspace-media-contract";

export type PreparedMedia = { bytes: Buffer; mimeType: string; extension: string; thumbnail?: Buffer;
  metadata: Record<string, unknown> };
function imageMagic(bytes: Buffer) {
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "png";
  if (bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WEBP") return "webp";
  return null;
}
export async function prepareMedia(input: UploadMetadata, original: Buffer): Promise<PreparedMedia> {
  if (!original.length) throw new MediaError("empty_file");
  if (original.length > uploadLimit(input.kind)) throw new MediaError("file_too_large", 413);
  const metadata: Record<string, unknown> = { uploadedSha256: mediaHash(original), uploadedBytes: original.length,
    filename: input.filename, caption: input.caption, alt: input.alt, pipelineVersion: 1 };
  if (["photo", "drawing", "render"].includes(input.kind)) {
    const format = imageMagic(original);
    if (!format) throw new MediaError("unsupported_file");
    try {
      const decoder = sharp(original, { limitInputPixels: MEDIA_LIMITS.imagePixels, failOn: "warning", animated: false });
      const info = await decoder.metadata();
      if (info.format !== format || !info.width || !info.height || info.width > MEDIA_LIMITS.imageSide
        || info.height > MEDIA_LIMITS.imageSide || (info.pages ?? 1) !== 1) throw new MediaError("image_budget_exceeded");
      // The immutable source is this privacy-clean image. Raw GPS/EXIF bytes are never persisted.
      // rotate() applies EXIF orientation before the default metadata-stripping encode.
      const converted = await decoder.rotate().png().toBuffer({ resolveWithObject: true });
      if (converted.data.length > MEDIA_LIMITS.imageBytes) throw new MediaError("file_too_large", 413);
      const thumbnail = await sharp(converted.data).resize(640,640,{fit:"inside",withoutEnlargement:true}).webp({quality:78}).toBuffer();
      return { bytes: converted.data, mimeType: "image/png", extension: "png", thumbnail,
        metadata: { ...metadata, width: converted.info.width, height: converted.info.height, privacyTransform: "oriented-metadata-stripped-png", originalBytesRetained: false } };
    } catch (error) {
      if (error instanceof MediaError) throw error;
      throw new MediaError("invalid_image");
    }
  }
  if (input.kind === "model") {
    const model = inspectGlb(original);
    let pixels = 0;
    for (const image of model.images) {
      const expected = image.mimeType === "image/png" ? "png" : "jpeg";
      if (imageMagic(image.bytes) !== expected) throw new MediaError("invalid_model_texture");
      try {
        const decoder = sharp(image.bytes, { limitInputPixels: MEDIA_LIMITS.texturePixels, failOn: "warning" });
        const info = await decoder.metadata();
        if (!info.width || !info.height || info.width > MEDIA_LIMITS.textureSide || info.height > MEDIA_LIMITS.textureSide || (info.pages ?? 1) !== 1)
          throw new MediaError("model_budget_exceeded");
        pixels += info.width * info.height;
        if (pixels > MEDIA_LIMITS.texturePixels) throw new MediaError("model_budget_exceeded");
        // Full bounded decode catches truncated texture streams without rewriting the model.
        await decoder.raw().toBuffer();
      } catch (error) { if (error instanceof MediaError) throw error; throw new MediaError("invalid_model_texture"); }
    }
    return { bytes: original, mimeType: "model/gltf-binary", extension: "glb",
      metadata: { ...metadata, vertices: model.vertices, triangles: model.triangles, texturePixels: pixels, originalBytesRetained: true } };
  }
  if (input.kind === "document") {
    if (original.toString("ascii",0,5) === "%PDF-" && original.subarray(-1024).includes(Buffer.from("%%EOF")))
      return { bytes: original, mimeType: "application/pdf", extension: "pdf", metadata: { ...metadata, originalBytesRetained: true, preview: "download-only" } };
    if (/\.csv$/i.test(input.filename)) {
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(original); } catch { throw new MediaError("invalid_csv"); }
      if (!text.trim() || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text) || text.split(/\r?\n/).length > 100_000) throw new MediaError("invalid_csv");
      return { bytes: original, mimeType: "text/csv", extension: "csv", metadata: { ...metadata, originalBytesRetained: true, preview: "download-only" } };
    }
  }
  throw new MediaError("unsupported_file");
}
