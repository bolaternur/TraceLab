import Link from "next/link";
import { notFound } from "next/navigation";
import { addAnnotation } from "@/server/actions";
import { requireTeam } from "@/server/auth";
import { sourceEventContext } from "@/server/evidence";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { formatTechnicalDate, getSourcePresentation } from "@/components/tracelab/presentation";

function metadataEntries(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [] as Array<[string, string]>;
  return Object.entries(raw as Record<string, unknown>)
    .filter(([key, value]) => !["added", "modified", "removed", "rawText"].includes(key) && value != null)
    .slice(0, 6)
    .map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : String(value)] as [string, string]);
}

export default async function AddContextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const ctx = await requireTeam();
  const detail = await sourceEventContext(ctx.team.id, id);
  if (!detail) notFound();

  const { ev, actor, subsystem, artifact, notes } = detail;
  const source = getSourcePresentation(ev.provider, ev.eventType);
  const rationales = notes.filter(({ a }) => a.field === "rationale" && a.provenance === "student");
  const latestRationale = rationales[0]?.a.body ?? "";
  const meta = metadataEntries(ev.rawMetadata);

  return (
    <main className="fade-in mx-auto w-full max-w-[880px] pb-24 sm:pb-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link href="/app" className="trace-button min-h-10 rounded-full px-3 text-sm">
          <span aria-hidden>←</span>
          Today
        </Link>
        <span className="trace-meta text-[10px] uppercase text-text-3">30-second why</span>
      </div>

      <section className="evidence-card overflow-hidden" data-tone="source">
        <div className="border-b border-border-subtle bg-surface px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-blueprint-bg text-blueprint">
                <TraceIcon name={source.mark} size={20} />
              </span>
              <div className="min-w-0">
                <div className="trace-meta flex flex-wrap items-center gap-x-1.5 text-[10px] uppercase text-text-3">
                  <span>{source.label}</span>
                  <span aria-hidden>·</span>
                  <span>{source.eventLabel}</span>
                  <span aria-hidden>·</span>
                  <span>{formatTechnicalDate(ev.occurredAt, ctx.team.timezone ?? "UTC")}</span>
                </div>
                <h1 className="mt-1 text-balance text-xl font-semibold leading-7 text-ink sm:text-2xl">{ev.title}</h1>
              </div>
            </div>
            <span className="badge badge-signal">Source preserved</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-2">
            {subsystem ? <span className="trace-chip">{subsystem}</span> : null}
            {actor ? <span className="trace-chip">By {actor}</span> : null}
            <span className="trace-chip">{ev.status === "linked" ? "Linked evidence" : "Evidence inbox"}</span>
          </div>

          {artifact?.storageKey ? (
            <div className="mt-4 overflow-hidden rounded-[18px] border border-border-subtle bg-canvas">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/media/${artifact.id}`} alt={ev.title} className="max-h-[340px] w-full object-contain" />
            </div>
          ) : null}

          {meta.length || artifact?.externalReference ? (
            <details className="mt-4 rounded-[14px] border border-border-subtle bg-canvas/70 px-3.5 py-3 text-xs">
              <summary className="cursor-pointer font-medium text-text-2">Source details</summary>
              <dl className="trace-meta mt-3 grid gap-2 text-[10px] text-text-3 sm:grid-cols-2">
                {meta.map(([key, value]) => (
                  <div key={key} className="min-w-0">
                    <dt className="uppercase">{key}</dt>
                    <dd className="mt-0.5 truncate text-text-2">{value}</dd>
                  </div>
                ))}
              </dl>
              {artifact?.externalReference ? (
                <a href={artifact.externalReference} target="_blank" rel="noreferrer noopener" className="mt-3 inline-flex text-blueprint hover:underline">
                  Open original source ↗
                </a>
              ) : null}
            </details>
          ) : null}
        </div>

        <div className="bg-canvas px-4 py-5 sm:px-6 sm:py-7">
          <div className="mx-auto max-w-[680px]">
            <div className="mb-5">
              <span className="trace-meta text-[10px] uppercase text-blueprint">Student context</span>
              <h2 className="mt-2 text-balance text-[28px] font-semibold leading-[1.08] tracking-[-0.025em] text-ink sm:text-[36px]">
                Why did you make this change?
              </h2>
              <p className="mt-2 max-w-[560px] text-sm leading-6 text-text-2">What were you trying to improve or fix? Keep it in your own words — the source facts above are already preserved.</p>
            </div>

            {ctx.canAuthorStudentContent ? (
              <form action={addAnnotation} className="rounded-[28px] border border-blueprint/20 bg-surface p-3 shadow-[0_18px_50px_rgba(17,19,21,0.07)] sm:p-4">
                <input type="hidden" name="entityType" value="source_event" />
                <input type="hidden" name="entityId" value={ev.id} />
                <input type="hidden" name="field" value="rationale" />
                <input type="hidden" name="returnTo" value={`/app/context/${ev.id}`} />
                <label htmlFor="student-rationale" className="sr-only">Why did you make this change?</label>
                <textarea
                  id="student-rationale"
                  name="body"
                  defaultValue={latestRationale}
                  required
                  minLength={2}
                  maxLength={5000}
                  autoFocus
                  rows={7}
                  placeholder="We changed… because…"
                  className="min-h-[176px] w-full resize-y rounded-[20px] border-0 bg-transparent px-2 py-2 text-[17px] leading-7 text-ink outline-none placeholder:text-text-3 focus-visible:ring-2 focus-visible:ring-blueprint/45"
                />
                <div className="mt-3 flex flex-col gap-3 border-t border-border-subtle pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-3">
                    <span className="inline-flex items-center gap-1.5 font-medium text-text-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-verified-green" aria-hidden />
                      Student-authored
                    </span>
                    <span aria-hidden>·</span>
                    <span>AI did not modify this text</span>
                  </div>
                  <button type="submit" className="trace-button trace-button-expressive min-h-12 justify-center rounded-full px-5 sm:min-w-[154px]">
                    Save context
                    <span aria-hidden>→</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="rounded-[22px] border border-border-subtle bg-surface p-4 text-sm leading-6 text-text-2">
                <strong className="text-ink">Student-authored field.</strong> Coaches can review this evidence, but cannot write or rewrite a student&apos;s rationale.
              </div>
            )}

            {rationales.length ? (
              <section className="mt-6" aria-labelledby="context-history-heading">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="context-history-heading" className="text-sm font-semibold text-ink">Source history</h3>
                  <span className="trace-meta text-[10px] uppercase text-text-3">{rationales.length} version{rationales.length === 1 ? "" : "s"}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {rationales.map(({ a, author }, index) => (
                    <article key={a.id} className="rounded-[18px] border border-border-subtle bg-surface px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-3">
                        <span className="font-medium text-text-2">{index === 0 ? "Current" : `Version ${rationales.length - index}`}</span>
                        <span aria-hidden>·</span>
                        <span>{author ?? "Student"}</span>
                        <span aria-hidden>·</span>
                        <span>{formatTechnicalDate(a.createdAt, ctx.team.timezone ?? "UTC")}</span>
                        {a.supersedesId ? <span className="badge">Revised</span> : null}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{a.body}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href={`/app/inbox?event=${ev.id}`} className="text-text-2 hover:text-ink">Open source inspector</Link>
        <Link href="/app/timeline" className="font-medium text-blueprint">Done · open timeline →</Link>
      </div>
    </main>
  );
}
