import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, teamMemberships } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { storage } from "@/server/storage";

export const runtime = "nodejs";

/** Private media. Membership is verified on every request; there are no permanent public URLs. */
export async function GET(_req: Request, { params }: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  if (!/^[0-9a-f-]{36}$/.test(artifactId)) return new NextResponse("Not found", { status: 404 });
  const rows = await db
    .select({ a: artifacts })
    .from(artifacts)
    .innerJoin(teamMemberships, and(eq(teamMemberships.teamId, artifacts.teamId), eq(teamMemberships.userId, user.id), eq(teamMemberships.status, "active")))
    .where(eq(artifacts.id, artifactId))
    .limit(1);
  const artifact = rows[0]?.a;
  // Same 404 for "does not exist" and "not yours" — no existence oracle.
  if (!artifact || !artifact.storageKey) return new NextResponse("Not found", { status: 404 });
  const bytes = await storage.get(artifact.storageKey);
  if (!bytes) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": artifact.mimeType ?? "application/octet-stream",
      "cache-control": "private, max-age=300",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
