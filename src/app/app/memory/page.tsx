import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiActionLogs } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { gate } from "@/server/policy";
import { getAiProvider } from "@/modules/ai/provider";
import { AskForm } from "./ask-form";
import { setAiDisposition } from "@/server/actions";
import { Mono, PageHeader, PolicyBadge, fmtDate } from "@/components/ui";
import { TraceIcon } from "@/components/tracelab/trace-icon";

export default async function MemoryPage() {
  const ctx = await requireTeam();
  const g = await gate(ctx, "generate_ai_memory_answer");
  const provider = getAiProvider();
  const logs = await db.select().from(aiActionLogs).where(eq(aiActionLogs.teamId, ctx.team.id)).orderBy(desc(aiActionLogs.createdAt)).limit(20);

  return (
    <div className="fade-in mx-auto max-w-[920px] pb-16">
      <PageHeader
        title="Memory"
        subtitle="Retrieve why past engineering decisions happened from stored evidence. Search and deterministic retrieval work first; generative phrasing is only a policy-gated layer on top."
        actions={
          <Link href="/app/graph" className="trace-button min-h-10 rounded-full px-4 text-sm">
            <TraceIcon name="graph" size={16} />
            Evidence trace
          </Link>
        }
      />

      <section className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="rounded-[18px] border border-border-subtle bg-surface px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-blueprint-bg text-blueprint">
              <TraceIcon name="memory" size={18} />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">Evidence-first answers</p>
              <p className="mt-0.5 text-xs leading-5 text-text-3">If there is not enough project evidence, Memory should say so instead of filling the gap.</p>
            </div>
          </div>
        </div>
        <div className="rounded-[18px] border border-border-subtle bg-surface px-4 py-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-3">Generative layer</span>
            <PolicyBadge decision={g.decision} />
          </div>
          <p className="mt-1 max-w-[280px] leading-5 text-text-3">{g.reason}</p>
          <p className="mt-1 text-text-3">Provider: <Mono>{provider.name}</Mono></p>
        </div>
      </section>

      <AskForm />

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">AI provenance log</h2>
            <p className="mt-0.5 text-xs text-text-3">Only machine-assisted actions appear here. Deterministic retrieval does not need to masquerade as AI.</p>
          </div>
          <span className="trace-meta text-[10px] uppercase text-text-3">Transparent by default</span>
        </div>
        {logs.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-border-default bg-canvas px-4 py-5 text-sm text-text-3">No AI actions yet.</div>
        ) : (
          <ul className="overflow-hidden rounded-[20px] border border-border-subtle bg-surface divide-y divide-border-subtle text-sm">
            {logs.map((l) => (
              <li key={l.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Mono>{fmtDate(l.createdAt, true)}</Mono>
                  <span className="badge">{l.action}</span>
                  <PolicyBadge decision={l.policyDecision} />
                  <span className="badge">{l.disposition}</span>
                  <Mono>{l.provider ?? "—"}{l.model ? ` · ${l.model}` : ""}{l.outputHash ? ` · ${l.outputHash.slice(0, 10)}` : ""}</Mono>
                </div>
                {l.prompt ? <p className="mt-2 text-text-2">Q: {l.prompt.slice(0, 160)}</p> : null}
                {l.disposition === "pending" ? (
                  <form action={setAiDisposition} className="mt-3 flex gap-2">
                    <input type="hidden" name="id" value={l.id} />
                    <button name="disposition" value="accepted" className="trace-button min-h-9 rounded-full px-3 text-xs">Mark useful</button>
                    <button name="disposition" value="rejected" className="trace-button min-h-9 rounded-full px-3 text-xs">Reject</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
