import { z } from "zod";

export const reviewInput = z.object({
  body: z.string().trim().min(10).max(1500),
  rating: z.coerce.number().int().min(1).max(5),
  consent: z.literal("yes"),
});

export function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function calendarDays(today: string, weeks = 26) {
  const end = new Date(`${today}T12:00:00Z`);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7) - (weeks - 1) * 7);
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + i);
    return day.toISOString().slice(0, 10);
  });
}
