import { NextResponse } from "next/server";

/** Historical subscriptions are retained. Billing events cannot change access. */
export function POST() {
  return NextResponse.json({ error: "billing_retired", message: "Iznera is free." }, { status: 410, headers: { "Cache-Control": "no-store" } });
}
