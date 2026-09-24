import Link from "next/link";
import { requireTeam } from "@/server/auth";
import { getActiveSeasonAndProject, listSubsystems, search, similarHistory } from "@/server/evidence";
import { EmptyState, Mono, OutcomeBadge, PageHeader, fmtDate } from "@/components/ui";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; subsystem?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireTeam();
  const q = (sp.q ?? "").trim().slice(0, 200);
  const { project, season } = await getActiveSeasonAndProject(ctx.team.id);
  const subs = await listSubsystems(ctx.team.id, project?.id);
  const results = q.length >= 2 ? await search(ctx.team.id, q, { type: sp.type || undefined, subsystemId: sp.subsystem || null }) : [];
  const history = q.length >= 4 ? await similarHistory(ctx.team.id, q, season?.id) : [];
  return (
    <div className="fade-in">
      <PageHeader title="Search" subtitle="Text search across iterations, tests, decisions, source events and student notes — scoped to your team." />
      <form className="card mb-6 flex flex-wrap gap-2 p-3" method="get" role="search">
        <input name="q" defaultValue={q} className="input flex-1" placeholder="chain intake, 36 mm, overshoot…" aria-label="Search query" autoFocus />
        <select name="type" className="select !w-auto" defaultValue={sp.type ?? ""} aria-label="Type">
          <option value="">All types</option>
          <option value="iteration">Iterations</option>
          <option value="test">Tests</option>
          <option value="decision">Decisions</option>
          <option value="source_event">Source events</option>
          <option value="annotation">Student notes</option>
        </select>
        <select name="subsystem" className="select !w-auto" defaultValue={sp.subsystem ?? ""} aria-label="Subsystem">
          <option value="">All subsystems</option>
          {subs.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button className="btn btn-primary">Search</button>
      </form>
      {history.length ? (
        <div className="card mb-6 border-warning/50 p-4 text-sm">
          <div className="font-medium">Similar approach found in a previous season</div>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.it.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/app/iterations/${h.it.id}`} className="text-blueprint">
                  {h.it.title}
                </Link>
                <OutcomeBadge outcome={h.it.outcome} />
                <Mono>
                  {h.season} · {h.subsystem ?? "—"}
                </Mono>
              </li>
            ))}
          </ul>
          <p className="hint mt-2">Context changes between seasons; treat past conclusions as a starting point.</p>
        </div>
      ) : null}
      {q.length < 2 ? (
        <p className="text-sm text-text-2">Type at least two characters. Tip: search a measurement like “36 mm” or a symptom like “jam”.</p>
      ) : results.length === 0 ? (
        <EmptyState title="No results" body="Try fewer words, a different subsystem filter, or a synonym (e.g. “wedged” instead of “stuck”). Student notes are searched too." />
      ) : (
        <ul className="card divide-y divide-border">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}-${r.detail}`}>
              <Link href={r.href} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-muted/60">
                <span className="min-w-0">
                  <span className="badge mr-2">{r.type.replace("_", " ")}</span>
                  <span className="truncate text-sm">{r.title}</span>
                </span>
                <Mono>
                  {r.detail} · {fmtDate(r.at)}
                </Mono>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
