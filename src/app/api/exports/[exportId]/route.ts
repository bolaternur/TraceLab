import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { exports as exportsTable, teamMemberships } from "@/db/schema";
import { getCurrentUser } from "@/server/auth";
import { storage } from "@/server/storage";
import { track } from "@/server/audit";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ exportId: string }> }) {
  const { exportId } = await params;
  const user = await getCurrentUser();
  if (!user || !/^[0-9a-f-]{36}$/.test(exportId)) return new NextResponse("Not found", { status: 404 });
  const rows = await db
    .select({ e: exportsTable })
    .from(exportsTable)
    .innerJoin(teamMemberships, and(eq(teamMemberships.teamId, exportsTable.teamId), eq(teamMemberships.userId, user.id), eq(teamMemberships.status, "active")))
    .where(eq(exportsTable.id, exportId))
    .limit(1);
  const exp = rows[0]?.e;
  if (!exp || !exp.storageKey) return new NextResponse("Not found", { status: 404 });
  // Personal contribution exports are only downloadable by their subject.
  if (exp.forUserId && exp.forUserId !== user.id) return new NextResponse("Not found", { status: 404 });
  const bytes = await storage.get(exp.storageKey);
  if (!bytes) return new NextResponse("Not found", { status: 404 });
  await track("export.downloaded", { teamId: exp.teamId, userId: user.id, props: { type: exp.type } });
  const ext = exp.storageKey.split(".").pop();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "content-type": ext === "json" ? "application/json" : "text/html; charset=utf-8",
      "content-disposition": `attachment; filename="${exp.type}-v${exp.version}.${ext}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, no-store",
    },
  });
}
