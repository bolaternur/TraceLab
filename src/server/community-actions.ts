"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { productReviews, productUsageDays } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { dayKey, reviewInput } from "@/lib/community";

export type ReviewState = { ok: boolean; error?: string } | null;

export async function recordUsageDay() {
  const ctx = await requireTeam();
  await db.insert(productUsageDays).values({ teamId: ctx.team.id, userId: ctx.user.id, day: dayKey(new Date(), ctx.team.timezone || "UTC") }).onConflictDoNothing();
}

export async function saveProductReview(_: ReviewState, form: FormData): Promise<ReviewState> {
  const ctx = await requireTeam();
  const parsed = reviewInput.safeParse({ body: form.get("body"), rating: form.get("rating"), consent: form.get("consent") });
  if (!parsed.success) return { ok: false, error: "Review validation failed" };
  try {
    await db.insert(productReviews).values({ teamId: ctx.team.id, userId: ctx.user.id, body: parsed.data.body, rating: parsed.data.rating })
      .onConflictDoUpdate({ target: [productReviews.teamId, productReviews.userId], set: { body: parsed.data.body, rating: parsed.data.rating, updatedAt: new Date() } });
    revalidatePath("/app/community");
    return { ok: true };
  } catch { return { ok: false, error: "Review could not be saved" }; }
}

export async function deleteProductReview(): Promise<ReviewState> {
  const ctx = await requireTeam();
  try {
    await db.delete(productReviews).where(and(eq(productReviews.teamId, ctx.team.id), eq(productReviews.userId, ctx.user.id)));
    revalidatePath("/app/community");
    return { ok: true };
  } catch { return { ok: false, error: "Review could not be saved" }; }
}
