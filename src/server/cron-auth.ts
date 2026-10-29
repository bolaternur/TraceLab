import { createHash, timingSafeEqual } from "node:crypto";

/** Only a bounded bearer value is compared; credentials are never returned. */
export function authorizedCron(headers: Headers, secret: string | undefined) {
  if (!secret || secret.length < 32 || secret.length > 512) return false;
  const supplied = /^Bearer ([^\s]{32,512})$/i.exec(headers.get("authorization") || "")?.[1];
  if (!supplied) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(secret));
}
