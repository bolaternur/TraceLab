import { NextResponse } from "next/server";
import { AccountError } from "@/server/account-contract";
import { accountSettingsFailure, accountSettingsIdentity } from "@/server/account-settings-http";
import { exportAccountData } from "@/server/account-data-service";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new AccountError("origin_rejected", 403);
    const data = await exportAccountData(await accountSettingsIdentity());
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store, max-age=0", "Referrer-Policy": "no-referrer", "Content-Disposition": 'attachment; filename="iznera-account-data.json"' } });
  } catch (error) { return accountSettingsFailure(error); }
}
