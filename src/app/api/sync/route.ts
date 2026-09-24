import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, listUserTeams } from "@/server/auth";
import { persistCapture, type CaptureInput } from "@/server/actions";
import { track } from "@/server/audit";

export const runtime = "nodejs";

const MAX_SYNC_BODY_BYTES = 10 * 1024 * 1024;

const item = z.object({
  clientId: z.string().min(8).max(80),
  teamId: z.string().uuid(),
  fields: z.record(z.string(), z.string()),
  photo: z.object({ name: z.string().max(200), type: z.string().max(60), dataBase64: z.string().max(20_000_000) }).nullable().optional(),
});

/**
 * Offline outbox sync. Idempotent per teamId + clientId; the original local timestamp is preserved via fields.occurredAt.
 * Each item is authorised against the caller's active team memberships.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SYNC_BODY_BYTES) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_SYNC_BODY_BYTES) return NextResponse.json({ error: "payload too large" }, { status: 413 });
  const body = (() => { try { return JSON.parse(raw) as unknown; } catch { return null; } })();
  const parsed = z.object({ items: z.array(item).max(8) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  const teams = await listUserTeams(user.id);
  const allowed = new Map(teams.map((t) => [t.team.id, t.role]));
  const results: Array<{ clientId: string; status: "synced" | "duplicate" | "rejected"; error?: string; eventId?: string }> = [];
  for (const it of parsed.data.items) {
    const role = allowed.get(it.teamId);
    if (!role || role === "coach") {
      results.push({ clientId: it.clientId, status: "rejected", error: "not authorised for this team" });
      continue;
    }
    try {
      const input = { ...it.fields, clientId: it.clientId } as unknown as CaptureInput;
      let file: File | null = null;
      if (it.photo) {
        const bytes = Buffer.from(it.photo.dataBase64, "base64");
        file = new File([new Uint8Array(bytes)], it.photo.name, { type: it.photo.type });
      }
      const r = await persistCapture(it.teamId, user.id, input, file);
      results.push({ clientId: it.clientId, status: r.deduplicated ? "duplicate" : "synced", eventId: r.eventId });
      if (!r.deduplicated) await track("capture.synced", { teamId: it.teamId, userId: user.id, props: { kind: it.fields.kind } });
    } catch (err) {
      results.push({ clientId: it.clientId, status: "rejected", error: err instanceof Error ? err.message : "failed" });
    }
  }
  return NextResponse.json({ results });
}
