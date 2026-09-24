import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { iterations } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { clusterEvents, inbox, listSubsystems, getActiveSeasonAndProject, annotationHistory } from "@/server/evidence";
import { triageEvents } from "@/server/actions";
import { EmptyState, PageHeader, SourceBadge, fmtDate, Mono, ProvenanceLabel } from "@/components/ui";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ status?: string; event?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTeam();
  const status = sp.status === "linked" || sp.status === "ignored" ? sp.status : "inbox";
  const rows = await inbox(ctx.team.id, { status });
  const { project } = await getActiveSeasonAndProject(ctx.team.id);
  const subs = await listSubsystems(ctx.team.id, project?.id);
  const openIts = await db.select({ id: iterations.id, title: iterations.title }).from(iterations).where(and(eq(iterations.teamId, ctx.team.id), inArray(iterations.state, ["open", "testing", "deciding"]))).orderBy(desc(iterations.openedAt));
  const clusters = status === "inbox" ? clusterEvents(rows.map((r) => ({ id: r.ev.id, occurredAt: r.ev.occurredAt, subsystemId: r.ev.subsystemId, rawMetadata: r.ev.rawMetadata, provider: r.ev.provider }))) : [];
  const focus = sp.event ? rows.find((r) => r.ev.id === sp.event) ?? null : null;
  const focusNotes = focus ? await annotationHistory("source_event", focus.ev.id) : [];

  return (
    <div className="fade-in">
      <PageHeader
        title="Evidence Inbox"
        subtitle="Passive evidence from connected sources and quick captures. Link it to an iteration in one step — or group a cluster."
        actions={
          <div className="flex gap-1 rounded-md border border-border p-0.5 text-sm">
            {(["inbox", "linked", "ignored"] as const).map((s) => (
              <Link key={s} href={`/app/inbox?status=${s}`} className={`rounded px-3 py-1 ${status === s ? "bg-blueprint text-white" : "text-text-2"}`} aria-current={status === s ? "page" : undefined}>
                {s}
              </Link>
            ))}
          </div>
        }
      />

      {focus ? (
        <aside className="card mb-6 p-4" aria-label="Source inspector">
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge provider={focus.ev.provider} eventType={focus.ev.eventType} />
            <ProvenanceLabel kind="source" />
            <Mono>{fmtDate(focus.ev.occurredAt, true)}</Mono>
            {focus.ev.visibility === "sensitive" ? <span className="badge badge-danger">sensitive</span> : null}
          </div>
          <h2 className="mt-2 text-lg font-semibold">{focus.ev.title}</h2>
          {focus.ev.summary ? <p className="mt-1 text-sm text-text-2">{focus.ev.summary}</p> : null}
          {focus.artifact?.storageKey ? <img src={`/api/media/${focus.artifact.id}`} alt={focus.ev.title} className="mt-3 max-h-80 rounded-md border border-border object-contain" /> : null}
          {focus.artifact?.externalReference ? (
            <a className="mt-2 inline-block text-sm text-blueprint" href={focus.artifact.externalReference} rel="noreferrer noopener" target="_blank">
              Open source ↗
            </a>
          ) : null}
          <dl className="mono mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-2 md:grid-cols-4">
            {Object.entries(focus.ev.rawMetadata as Record<string, unknown>)
              .filter(([k]) => !["added", "modified", "removed", "rawText"].includes(k))
              .slice(0, 8)
              .map(([k, v]) => (
                <div key={k} className="truncate">
                  <dt className="inline text-text-3">{k}: </dt>
                  <dd className="inline">{typeof v === "object" ? JSON.stringify(v) : String(v)}</dd>
                </div>
              ))}
            <div>
              <dt className="inline text-text-3">hash: </dt>
              <dd className="inline">{focus.ev.contentHash.slice(0, 12)}</dd>
            </div>
          </dl>
          {focusNotes.length ? (
            <div className="mt-3 space-y-2">
              {focusNotes.map(({ a, author }) => (
                <div key={a.id} className="rounded-md border border-border p-2 text-sm">
                  <div className="mb-1 flex items-center gap-2">
                    <ProvenanceLabel kind={a.provenance} />
                    <Mono>
                      {author ?? "—"} · {a.field} · {fmtDate(a.createdAt, true)}
                      {a.supersedesId ? " · revised" : ""}
                    </Mono>
                  </div>
                  {a.body}
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/app/why/source_event/${focus.ev.id}`} className="btn btn-sm">
              Why?
            </Link>
            {ctx.canAuthorStudentContent ? (
              <Link href={`/app/context/${focus.ev.id}`} className="btn btn-sm btn-primary">
                Add the why
              </Link>
            ) : null}
            {focus.ev.iterationId ? (
              <Link href={`/app/iterations/${focus.ev.iterationId}`} className="btn btn-sm">
                Open iteration
              </Link>
            ) : null}
          </div>
        </aside>
      ) : null}

      {clusters.length ? (
        <section className="mb-6" aria-label="Suggested clusters">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-text-3">Possible iterations (deterministic suggestion)</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {clusters.map((c) => (
              <form key={c.key} action={triageEvents} className="card p-3 text-sm">
                {c.eventIds.map((id) => (
                  <input key={id} type="hidden" name="eventId" value={id} />
                ))}
                <div className="flex items-center gap-2">
                  <ProvenanceLabel kind="suggestion" />
                  <span className="font-medium">{c.label}</span>
                </div>
                <p className="mt-1 text-text-2">{c.reason}</p>
                <ul className="mono mt-2 max-h-24 overflow-y-auto text-xs text-text-3">
                  {c.eventIds.map((id) => (
                    <li key={id}>· {rows.find((r) => r.ev.id === id)?.ev.title}</li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input name="title" className="input !min-h-8 flex-1 text-sm" placeholder="Iteration title" required />
                  <button name="action" value="create_iteration" className="btn btn-sm btn-primary">
                    Group into new iteration
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          title={status === "inbox" ? "Inbox is clear" : `No ${status} evidence`}
          body={status === "inbox" ? "Start with a photo or connect GitHub. New commits, CAD revisions and chat captures will arrive here automatically." : "Nothing here yet."}
          action={
            <div className="flex gap-2">
              <Link href="/app/capture" className="btn btn-primary">
                Capture
              </Link>
              <Link href="/app/integrations" className="btn">
                Connect a source
              </Link>
            </div>
          }
        />
      ) : (
        <form action={triageEvents}>
          <div className="card sticky top-[49px] z-10 mb-3 flex flex-wrap items-center gap-2 p-2 text-sm md:top-0">
            <span className="px-1 text-text-3">Selected →</span>
            <select name="iterationId" className="select !min-h-8 !w-auto text-sm" aria-label="Iteration to link">
              <option value="">Choose iteration…</option>
              {openIts.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.title}
                </option>
              ))}
            </select>
            <button name="action" value="link" className="btn btn-sm btn-primary">
              Link to iteration
            </button>
            <select name="subsystemId" className="select !min-h-8 !w-auto text-sm" aria-label="Subsystem">
              <option value="">Subsystem…</option>
              {subs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <button name="action" value="subsystem" className="btn btn-sm">
              Set subsystem
            </button>
            <input name="title" className="input !min-h-8 !w-40 text-sm" placeholder="New iteration title" />
            <button name="action" value="create_iteration" className="btn btn-sm">
              Create iteration
            </button>
            {status === "inbox" ? (
              <button name="action" value="ignore" className="btn btn-sm">
                Ignore
              </button>
            ) : (
              <button name="action" value="restore" className="btn btn-sm">
                Restore to inbox
              </button>
            )}
            {ctx.canOrganize ? (
              <button name="action" value="sensitive" className="btn btn-sm btn-danger">
                Mark sensitive
              </button>
            ) : null}
          </div>
          <ul className="card divide-y divide-border">
            {rows.map(({ ev, actor, subsystem, artifact }) => (
              <li key={ev.id} className={`flex items-start gap-3 p-3 ${sp.event === ev.id ? "bg-blueprint-bg/40" : ""}`}>
                <input type="checkbox" name="eventId" value={ev.id} aria-label={`Select ${ev.title}`} className="mt-1.5 h-4 w-4" />
                {artifact?.storageKey ? <img src={`/api/media/${artifact.id}`} alt="" className="h-12 w-12 rounded border border-border object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <SourceBadge provider={ev.provider} eventType={ev.eventType} />
                    {subsystem ? <span className="badge">{subsystem}</span> : null}
                    {ev.iterationId ? <span className="badge badge-success">linked</span> : null}
                    {ev.visibility === "sensitive" ? <span className="badge badge-danger">sensitive</span> : null}
                  </div>
                  <Link href={`/app/inbox?status=${status}&event=${ev.id}`} className="mt-1 block truncate text-sm font-medium hover:underline">
                    {ev.title}
                  </Link>
                  <div className="mono text-[11px] text-text-3">
                    {actor ?? ev.actorExternalId ?? "unknown author"} · {fmtDate(ev.occurredAt, true)}
                    {(ev.rawMetadata as { repository?: string }).repository ? ` · ${(ev.rawMetadata as { repository?: string }).repository}` : ""}
                    {(ev.rawMetadata as { sha?: string }).sha ? ` · ${(ev.rawMetadata as { sha: string }).sha.slice(0, 7)}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </form>
      )}
    </div>
  );
}
