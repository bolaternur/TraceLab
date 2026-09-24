import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { annotations, decisions, relations, subsystems, users } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { DecisionState, EmptyState, Mono, PageHeader, ProvenanceLabel, WhyLink, fmtDate } from "@/components/ui";

const FILTERS = [
  ["all", "All"],
  ["no_evidence", "Without evidence"],
  ["quantitative", "Based on quantitative tests"],
  ["open", "Open"],
  ["deferred", "Deferred"],
  ["reversed", "Later reversed"],
] as const;

export default async function DecisionsPage({ searchParams }: { searchParams: Promise<{ filter?: string; focus?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTeam();
  const filter = FILTERS.some(([k]) => k === sp.filter) ? (sp.filter as (typeof FILTERS)[number][0]) : "all";
  const rows = await db.select({ d: decisions, subsystem: subsystems.name, author: users.displayName }).from(decisions).leftJoin(subsystems, eq(subsystems.id, decisions.subsystemId)).leftJoin(users, eq(users.id, decisions.authorUserId)).where(eq(decisions.teamId, ctx.team.id)).orderBy(desc(decisions.decidedAt)).limit(300);
  const ids = rows.map((r) => r.d.id);
  const rels = ids.length ? await db.select().from(relations).where(and(eq(relations.teamId, ctx.team.id), eq(relations.fromType, "decision"), inArray(relations.fromId, ids), eq(relations.status, "accepted"))) : [];
  const rationales = ids.length ? await db.select().from(annotations).where(and(eq(annotations.teamId, ctx.team.id), eq(annotations.entityType, "decision"), inArray(annotations.entityId, ids), eq(annotations.field, "rationale"))).orderBy(desc(annotations.createdAt)) : [];
  const rationaleFor = new Map<string, (typeof rationales)[number]>();
  for (const r of rationales) if (!rationaleFor.has(r.entityId)) rationaleFor.set(r.entityId, r);
  const evidenceFor = new Map<string, typeof rels>();
  for (const r of rels) evidenceFor.set(r.fromId, [...(evidenceFor.get(r.fromId) ?? []), r]);
  const withTest = new Set(rels.filter((r) => r.toType === "test").map((r) => r.fromId));
  const filtered = rows.filter(({ d }) => {
    const ev = (evidenceFor.get(d.id) ?? []).filter((r) => r.toType !== "source_event" || r.relationType !== "DERIVED_FROM");
    if (filter === "no_evidence") return ev.length === 0;
    if (filter === "quantitative") return withTest.has(d.id);
    if (filter === "open") return d.status === "open";
    if (filter === "deferred") return d.disposition === "defer";
    if (filter === "reversed") return d.status === "reversed" || d.disposition === "revert";
    return true;
  });
  return (
    <div className="fade-in">
      <PageHeader
        title="Decisions"
        subtitle="Problem → alternatives → tests → evidence → decision → next iteration. Missing links are shown neutrally as “evidence link missing”."
        actions={ctx.canAuthorStudentContent ? <Link href="/app/capture?kind=decision" className="btn btn-primary">New decision</Link> : undefined}
      />
      <div className="mb-4 flex flex-wrap gap-1 text-sm">
        {FILTERS.map(([k, label]) => (
          <Link key={k} href={`/app/decisions?filter=${k}`} className={`rounded-md border px-3 py-1 ${filter === k ? "border-blueprint bg-blueprint-bg text-blueprint" : "border-border text-text-2"}`} aria-current={filter === k ? "page" : undefined}>
            {label}
          </Link>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="No decisions match" body={filter === "no_evidence" ? "Every decision has at least one linked test or artifact." : "Record a decision with its rationale from Capture."} />
      ) : (
        <ul className="space-y-3">
          {filtered.map(({ d, subsystem, author }) => {
            const ev = (evidenceFor.get(d.id) ?? []).filter((r) => !(r.toType === "source_event" && r.relationType === "DERIVED_FROM"));
            const r = rationaleFor.get(d.id);
            return (
              <li key={d.id} id={d.id} className={`card p-4 ${sp.focus === d.id ? "border-blueprint" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/app/decisions/${d.id}`} className="font-medium hover:text-blueprint hover:underline">{d.title}</Link>
                    <DecisionState disposition={d.disposition} />
                    {d.status !== "closed" ? <span className="badge badge-warning">{d.status}</span> : null}
                  </div>
                  <span className="flex items-center gap-2">
                    <Mono>
                      {subsystem ?? "—"} · {author ?? "—"} · {fmtDate(d.decidedAt)}
                    </Mono>
                    <WhyLink type="decision" id={d.id} />
                  </span>
                </div>
                {r ? (
                  <blockquote className="mt-2 border-l-2 border-teal pl-3 text-sm">
                    {r.body}
                    <div className="mt-1 flex items-center gap-2">
                      <ProvenanceLabel kind="student" />
                      {r.supersedesId ? <Mono>revised</Mono> : null}
                    </div>
                  </blockquote>
                ) : (
                  <p className="mt-2 text-sm text-text-3">Rationale not documented.</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {ev.length === 0 ? (
                    <span className="badge badge-warning">Evidence link missing</span>
                  ) : (
                    ev.map((x) => (
                      <Link key={x.id} href={x.toType === "test" ? `/app/tests/${x.toId}` : x.toType === "iteration" ? `/app/iterations/${x.toId}` : `/app/inbox?status=linked&event=${x.toId}`} className="badge badge-blueprint">
                        {x.relationType.toLowerCase()} → {x.toType.replace("_", " ")}
                      </Link>
                    ))
                  )}
                  {d.iterationId ? (
                    <Link href={`/app/iterations/${d.iterationId}`} className="text-blueprint">
                      iteration ↗
                    </Link>
                  ) : null}
                  {(d.alternatives as string[]).length ? <span className="text-text-3">alternatives: {(d.alternatives as string[]).join(" · ")}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
