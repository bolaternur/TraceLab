import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, subscriptions, webhookDeliveries } from "@/db/schema";
import { verifyStripeSignature } from "@/integrations/normalize";
import { log } from "@/server/audit";

export const runtime = "nodejs";

/**
 * Billing provider webhook (Stripe-compatible). Requires STRIPE_WEBHOOK_SECRET.
 * Synchronises subscription state → organization plan/entitlements. Idempotent on event id.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "billing webhook not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  let event: { id: string; type: string; data: { object: { id: string; customer?: string; status?: string; current_period_end?: number; metadata?: Record<string, string>; items?: { data?: Array<{ price?: { lookup_key?: string } }> } } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const inserted = await db.insert(webhookDeliveries).values({ provider: "stripe", deliveryId: event.id }).onConflictDoNothing().returning();
  if (!inserted.length) return NextResponse.json({ ok: true, duplicate: true });

  const obj = event.data.object;
  const orgId = obj.metadata?.organizationId;
  if (!orgId) return NextResponse.json({ ok: true, ignored: "no organizationId metadata" });
  const planMap: Record<string, string> = { club: "club", school: "school" };
  const lookup = obj.items?.data?.[0]?.price?.lookup_key ?? "";
  const plan = planMap[lookup] ?? "free";
  const status = obj.status ?? (event.type === "customer.subscription.deleted" ? "canceled" : "active");
  const effectivePlan = status === "active" || status === "trialing" ? plan : "free";

  await db
    .insert(subscriptions)
    .values({ organizationId: orgId, provider: "stripe", providerCustomerId: obj.customer ?? null, providerSubscriptionId: obj.id, plan: effectivePlan, status, currentPeriodEnd: obj.current_period_end ? new Date(obj.current_period_end * 1000) : null })
    .onConflictDoUpdate({ target: subscriptions.providerSubscriptionId, set: { plan: effectivePlan, status, currentPeriodEnd: obj.current_period_end ? new Date(obj.current_period_end * 1000) : null, updatedAt: new Date() } });
  await db.update(organizations).set({ plan: effectivePlan }).where(eq(organizations.id, orgId));
  log("info", "billing_synced", { orgId, plan: effectivePlan, status, type: event.type });
  return NextResponse.json({ ok: true });
}
