import { accountMutation, accountResponse } from "@/server/account-http";
import type { AccountAction } from "@/server/account-contract";

export const runtime = "nodejs";
const actions = new Set(["signup", "signin", "resend", "forgot", "verify", "reset", "logout"]);
export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!actions.has(action)) return accountResponse({ ok: false, code: "not_found" }, 404);
  return accountMutation(action as AccountAction, request);
}
