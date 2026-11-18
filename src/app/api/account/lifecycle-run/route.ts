import { authorizedCron } from "@/server/cron-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer" };
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers });

/** Trusted scheduler only. No account identities, object keys or provider errors leave this endpoint. */
export async function POST(request: Request) {
  if (!authorizedCron(request.headers, process.env.CRON_SECRET)) return reply({ ok: false, code: "unauthorized" }, 401);
  try {
    const [{ runLifecyclePurge }, { mediaStorage }] = await Promise.all([
      import("@/server/account-lifecycle-service"), import("@/server/workspace-media-storage"),
    ]);
    const result = await runLifecyclePurge(mediaStorage);
    const failed = result.failed > 0 || result.blocked > 0;
    return reply({ ok: !failed, ...result }, failed ? 503 : 200);
  } catch {
    console.error(JSON.stringify({ level: "error", event: "account_lifecycle_dispatch_failed" }));
    return reply({ ok: false, code: "lifecycle_dispatch_unavailable" }, 503);
  }
}
