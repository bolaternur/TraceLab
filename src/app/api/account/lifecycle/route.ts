import { AccountError, accountOrigin, readAccountJson } from "@/server/account-contract";
import { accountResponse } from "@/server/account-http";
import { accountSettingsFailure, accountSettingsIdentity } from "@/server/account-settings-http";
import { getAccountLifecycle, manageAccountLifecycle } from "@/server/account-lifecycle-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new AccountError("origin_rejected", 403);
    return accountResponse(await getAccountLifecycle(await accountSettingsIdentity()));
  } catch (error) { return accountSettingsFailure(error); }
}

export async function POST(request: Request) {
  try {
    accountOrigin(request.url, request.headers);
    const identity = await accountSettingsIdentity();
    const result = await manageAccountLifecycle(identity, await readAccountJson(request, 4096));
    return accountResponse(result);
  } catch (error) {
    const response = accountSettingsFailure(error);
    if (response.status === 429) response.headers.set("Retry-After", "900");
    return response;
  }
}
