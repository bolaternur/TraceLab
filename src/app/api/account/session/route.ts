import { accountSession } from "@/server/account-http";
export const runtime = "nodejs";
export async function GET() { return accountSession(); }
