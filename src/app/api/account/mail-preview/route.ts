import { accountMailPreview } from "@/server/account-http";
export const runtime = "nodejs";
export async function GET(request: Request) { return accountMailPreview(request); }
