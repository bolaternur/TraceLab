import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireUser } from "@/server/auth";
import { markNotificationsRead } from "@/server/actions";
import { EmptyState, Mono, PageHeader, fmtDate } from "@/components/ui";

export default async function NotificationsPage() {
  const user = await requireUser();
  const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
  return (
    <div className="fade-in mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle="Low-pressure by design: no streaks, no daily guilt. Preferences are in Settings."
        actions={
          rows.some((r) => !r.readAt) ? (
            <form action={markNotificationsRead}>
              <button className="btn btn-sm">Mark all read</button>
            </form>
          ) : undefined
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="Nothing to report" body="You'll hear about exports that are ready, invitations, integration disconnects, policy updates and tests that still need a decision." />
      ) : (
        <ul className="card divide-y divide-border text-sm">
          {rows.map((n) => (
            <li key={n.id} className={`p-3 ${n.readAt ? "opacity-70" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{n.title}</span>
                <Mono>{fmtDate(n.createdAt, true)}</Mono>
              </div>
              {n.body ? <p className="mt-1 text-text-2">{n.body}</p> : null}
              {n.href ? (
                <Link href={n.href} className="mt-1 inline-block text-blueprint">
                  Open
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
