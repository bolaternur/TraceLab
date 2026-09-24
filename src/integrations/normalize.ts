import { createHmac, timingSafeEqual } from "node:crypto";

/** Provider-neutral normalized event. Every connector maps into this before insert. */
export interface NormalizedEvent {
  providerEventId: string;
  eventType: string;
  title: string;
  summary?: string | null;
  actorExternalId?: string | null;
  occurredAt: Date;
  rawMetadata: Record<string, unknown>;
  artifact?: { kind: string; externalReference: string; metadata?: Record<string, unknown> } | null;
}

export function verifyGithubSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface GithubPushPayload {
  ref?: string;
  repository?: { full_name?: string; html_url?: string };
  pusher?: { name?: string };
  commits?: Array<{ id: string; message: string; timestamp: string; url: string; author?: { name?: string; username?: string; email?: string }; added?: string[]; modified?: string[]; removed?: string[] }>;
}

/** GitHub push → one SourceEvent per commit (metadata only; no repository contents). */
export function normalizeGithubPush(payload: GithubPushPayload): NormalizedEvent[] {
  const repo = payload.repository?.full_name ?? "unknown/repo";
  const branch = payload.ref?.replace("refs/heads/", "") ?? null;
  return (payload.commits ?? []).map((c) => ({
    providerEventId: c.id,
    eventType: "commit",
    title: c.message.split("\n")[0].slice(0, 200),
    summary: c.message.length > 200 ? c.message.slice(0, 1000) : null,
    actorExternalId: c.author?.username ?? c.author?.name ?? null,
    occurredAt: new Date(c.timestamp),
    rawMetadata: { repository: repo, branch, sha: c.id, url: c.url, changedFiles: (c.added?.length ?? 0) + (c.modified?.length ?? 0) + (c.removed?.length ?? 0), added: c.added?.slice(0, 50), modified: c.modified?.slice(0, 50), removed: c.removed?.slice(0, 50) },
    artifact: { kind: "commit", externalReference: c.url, metadata: { sha: c.id } },
  }));
}

interface OnshapeWebhookPayload {
  event?: string;
  documentId?: string;
  workspaceId?: string;
  elementId?: string;
  versionId?: string;
  microversionId?: string;
  timestamp?: string;
  messageId?: string;
  data?: Record<string, unknown>;
  user?: { id?: string; name?: string };
}

/** Onshape webhook → CAD revision SourceEvent. Says "the design changed", never why. */
export function normalizeOnshape(payload: OnshapeWebhookPayload): NormalizedEvent | null {
  if (!payload.documentId) return null;
  const id = payload.messageId ?? `${payload.documentId}:${payload.microversionId ?? payload.versionId ?? payload.timestamp}`;
  return {
    providerEventId: id,
    eventType: payload.event?.includes("version") ? "cad_version" : "cad_revision",
    title: payload.event === "onshape.model.lifecycle.createversion" ? `CAD version created` : `CAD document changed`,
    actorExternalId: payload.user?.id ?? null,
    occurredAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
    rawMetadata: { documentId: payload.documentId, workspaceId: payload.workspaceId, elementId: payload.elementId, versionId: payload.versionId, microversionId: payload.microversionId, event: payload.event },
    artifact: { kind: "cad_revision", externalReference: `https://cad.onshape.com/documents/${payload.documentId}${payload.workspaceId ? `/w/${payload.workspaceId}` : ""}${payload.elementId ? `/e/${payload.elementId}` : ""}` },
  };
}

interface TelegramUpdate {
  update_id?: number;
  message?: { message_id: number; date: number; text?: string; caption?: string; from?: { id: number; username?: string; first_name?: string }; chat?: { id: number; title?: string }; photo?: Array<{ file_id: string; width: number; height: number }> };
}

export function extractTags(text: string): string[] {
  return [...text.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((m) => m[1].toLowerCase());
}

/** Parse "17/20" style results out of chat text — presented as metadata, never as an authoritative test. */
export function extractRatio(text: string): { successes: number; trials: number } | null {
  const m = text.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return null;
  const s = Number(m[1]), t = Number(m[2]);
  if (!Number.isFinite(s) || !Number.isFinite(t) || t === 0 || s > t) return null;
  return { successes: s, trials: t };
}

export function normalizeTelegram(update: TelegramUpdate): NormalizedEvent | null {
  const m = update.message;
  if (!m) return null;
  const text = m.text ?? m.caption ?? "";
  const tags = extractTags(text);
  const ratio = extractRatio(text);
  const photo = m.photo?.[m.photo.length - 1];
  return {
    providerEventId: `${m.chat?.id ?? "chat"}:${m.message_id}`,
    eventType: photo ? "photo" : "message",
    title: text.split("\n")[0].slice(0, 200) || "Chat capture",
    summary: text.length > 200 ? text : null,
    actorExternalId: m.from?.username ?? String(m.from?.id ?? ""),
    occurredAt: new Date(m.date * 1000),
    rawMetadata: { chat: m.chat?.title ?? String(m.chat?.id), tags, ratio, rawText: text, updateId: update.update_id },
    artifact: photo ? { kind: "photo", externalReference: `telegram:file:${photo.file_id}`, metadata: { width: photo.width, height: photo.height } } : null,
  };
}

interface DiscordMessage {
  id: string;
  content?: string;
  timestamp?: string;
  author?: { id: string; username?: string };
  channel_id?: string;
  attachments?: Array<{ id: string; url: string; content_type?: string }>;
}

export function normalizeDiscord(msg: DiscordMessage): NormalizedEvent {
  const text = msg.content ?? "";
  const att = msg.attachments?.[0];
  return {
    providerEventId: msg.id,
    eventType: att?.content_type?.startsWith("image/") ? "photo" : "message",
    title: text.split("\n")[0].slice(0, 200) || "Chat capture",
    summary: text.length > 200 ? text : null,
    actorExternalId: msg.author?.username ?? msg.author?.id ?? null,
    occurredAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    rawMetadata: { channel: msg.channel_id, tags: extractTags(text), ratio: extractRatio(text), rawText: text },
    artifact: att ? { kind: att.content_type?.startsWith("image/") ? "photo" : "document", externalReference: att.url } : null,
  };
}

/** Stripe-style signature verification (t=...,v1=...) implemented without the SDK. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected), b = Buffer.from(parts.v1 ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
