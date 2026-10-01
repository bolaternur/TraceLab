import { and, desc, eq, gte, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { analyticsEvents, productReviews, productUsageDays, users } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { calendarDays, dayKey } from "@/lib/community";
import { isLocale } from "@/lib/i18n";
import { CommunityView } from "@/components/community/community-view";

export default async function CommunityPage() {
  const ctx = await requireTeam();
  const rawLocale = (await cookies()).get("pt_lang")?.value ?? ctx.user.locale;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const today = dayKey(new Date(), ctx.team.timezone || "UTC");
  const days = calendarDays(today);
  const [visits, activity, reviews] = await Promise.all([
    db.select({ day: productUsageDays.day }).from(productUsageDays).where(and(eq(productUsageDays.teamId, ctx.team.id), eq(productUsageDays.userId, ctx.user.id), gte(productUsageDays.day, days[0]))),
    db.select({ day: sql<string>`to_char(${analyticsEvents.createdAt} AT TIME ZONE ${ctx.team.timezone || "UTC"}, 'YYYY-MM-DD')`, count: sql<number>`count(*)::integer` }).from(analyticsEvents).where(and(eq(analyticsEvents.teamId, ctx.team.id), eq(analyticsEvents.userId, ctx.user.id), gte(analyticsEvents.createdAt, new Date(`${days[0]}T00:00:00Z`)))).groupBy(sql`1`),
    db.select({ id: productReviews.id, userId: productReviews.userId, name: users.displayName, body: productReviews.body, rating: productReviews.rating, updatedAt: productReviews.updatedAt }).from(productReviews).innerJoin(users, eq(users.id, productReviews.userId)).where(eq(productReviews.teamId, ctx.team.id)).orderBy(desc(productReviews.updatedAt)).limit(100),
  ]);
  const counts = Object.fromEntries(activity.map(row => [row.day, Number(row.count)]));
  for (const { day } of visits) counts[day] = Math.max(counts[day] || 0, 1);
  counts[today] = Math.max(counts[today] || 0, 1);
  return <CommunityView locale={locale} today={today} days={days} counts={counts} userId={ctx.user.id} reviews={reviews.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() }))} />;
}
