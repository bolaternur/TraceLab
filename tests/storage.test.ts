import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, sniffContentType, stripJpegMetadata } from "../src/server/storage";

function jpegWithExif(): Buffer {
  const soi = Buffer.from([0xff, 0xd8]);
  const exifPayload = Buffer.from("Exif\0\0GPSLAT12.34");
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(exifPayload.length + 2) >> 8, (exifPayload.length + 2) & 0xff]), exifPayload]);
  const dqtPayload = Buffer.alloc(4, 1);
  const dqt = Buffer.concat([Buffer.from([0xff, 0xdb]), Buffer.from([0, dqtPayload.length + 2]), dqtPayload]);
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0xff, 0xd9]);
  return Buffer.concat([soi, app1, dqt, sos]);
}

describe("photo privacy", () => {
  it("strips EXIF/GPS APP1 segments and preserves image data", () => {
    const original = jpegWithExif();
    expect(original.includes(Buffer.from("GPSLAT"))).toBe(true);
    const stripped = stripJpegMetadata(original);
    expect(stripped.includes(Buffer.from("GPSLAT"))).toBe(false);
    expect(stripped[0]).toBe(0xff);
    expect(stripped[1]).toBe(0xd8);
    expect(stripped.includes(Buffer.from([0xff, 0xdb]))).toBe(true);
    expect(stripped.includes(Buffer.from([0xff, 0xda]))).toBe(true);
  });
  it("sniffs content types from magic bytes, ignoring client claims", () => {
    expect(sniffContentType(jpegWithExif())).toBe("image/jpeg");
    expect(sniffContentType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe("image/png");
    expect(sniffContentType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
    expect(sniffContentType(Buffer.from("%PDF-1.4"))).toBe("application/pdf");
  });
});

describe("connector secret encryption", () => {
  it("round-trips and detects tampering", () => {
    const token = encryptSecret('{"webhookSecret":"abc"}');
    expect(token.startsWith("v1.")).toBe(true);
    expect(decryptSecret(token)).toBe('{"webhookSecret":"abc"}');
    const parts = token.split(".");
    parts[3] = parts[3].slice(0, -2) + "AA";
    expect(() => decryptSecret(parts.join("."))).toThrow();
  });
});
