import Link from "next/link";
import { cookies } from "next/headers";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { artifacts, robotModels, sourceEvents, users } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { isLocale, translate, type TranslationKey } from "@/lib/i18n";
import { Mono, PageHeader, ProvenanceLabel, fmtDate } from "@/components/ui";
import { SecureModelViewer } from "@/components/tracelab/secure-model-viewer";

const CATEGORIES = ["assembly", "part", "robot"] as const;

export default async function ModelsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; model?: string }> }) {
  const ctx = await requireTeam();
  const sp = await searchParams;
  const jar = await cookies();
  const rawLocale = jar.get("pt_lang")?.value ?? ctx.user.locale;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const t = (key: TranslationKey) => translate(locale, key);
  const query = sp.q?.trim().slice(0, 80) ?? "";
  const category = CATEGORIES.includes(sp.category as (typeof CATEGORIES)[number]) ? sp.category! : "";
  const conditions: SQL[] = [eq(robotModels.teamId, ctx.team.id), eq(robotModels.status, "active")];
  if (category) conditions.push(eq(robotModels.category, category));
  if (query) conditions.push(or(ilike(robotModels.name, `%${query}%`), ilike(robotModels.description, `%${query}%`))!);

  const rows = await db
    .select({ model: robotModels, artifact: artifacts, event: sourceEvents, author: users.displayName })
    .from(robotModels)
    .innerJoin(artifacts, eq(artifacts.id, robotModels.artifactId))
    .innerJoin(sourceEvents, eq(sourceEvents.id, robotModels.sourceEventId))
    .leftJoin(users, eq(users.id, robotModels.createdBy))
    .where(and(...conditions))
    .orderBy(desc(robotModels.updatedAt));
  const selected = rows.find((row) => row.model.id === sp.model) ?? rows[0] ?? null;
  const categoryLabel = (value: string) => value === "assembly" ? t("models.assembly") : value === "robot" ? t("models.robot") : t("models.part");

  return (
    <div className="fade-in">
      <PageHeader title={t("models.title")} subtitle={t("models.subtitle")} actions={<span className="badge badge-success">{t("models.private")}</span>} />
      <form className="card mb-5 grid gap-3 p-3 sm:grid-cols-[1fr_190px_auto]" action="/app/models">
        <label className="sr-only" htmlFor="model-search">{t("models.search")}</label>
        <input id="model-search" name="q" className="input" defaultValue={query} placeholder={t("models.search")} />
        <select name="category" className="select" defaultValue={category} aria-label={t("models.all")}>
          <option value="">{t("models.all")}</option>
          {CATEGORIES.map((value) => <option key={value} value={value}>{categoryLabel(value)}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">{t("models.search")}</button>
      </form>

      {selected ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section>
            <SecureModelViewer
              key={selected.model.id}
              src={`/api/media/${selected.artifact.id}`}
              title={selected.model.name}
              labels={{ loading: t("models.loading"), error: t("models.error"), reset: t("models.reset"), wireframe: t("models.wireframe"), solid: t("models.solid"), fullscreen: t("models.fullscreen"), hint: t("models.hint") }}
            />
            <div className="card mt-4 p-5">
              <div className="flex flex-wrap items-center gap-2"><span className="badge badge-blueprint">{categoryLabel(selected.model.category)}</span><ProvenanceLabel kind="source" /><Mono>{selected.model.versionLabel ?? "v1"}</Mono></div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{selected.model.name}</h2>
              {selected.model.description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-text-2">{selected.model.description}</p> : null}
              <dl className="mt-4 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-3">
                <div><dt className="text-xs uppercase tracking-wider text-text-3">Source</dt><dd className="mt-1">{String((selected.event.rawMetadata as Record<string, unknown>).originalFile ?? "GLB artifact")}</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-text-3">Optimized size</dt><dd className="mt-1">{((selected.artifact.sizeBytes ?? 0) / 1024 / 1024).toFixed(1)} MB</dd></div>
                <div><dt className="text-xs uppercase tracking-wider text-text-3">Imported</dt><dd className="mt-1">{fmtDate(selected.event.occurredAt)} · {selected.author ?? "—"}</dd></div>
              </dl>
            </div>
          </section>

          <aside className="space-y-3" aria-label="Model library">
            {rows.map((row) => {
              const params = new URLSearchParams();
              if (query) params.set("q", query);
              if (category) params.set("category", category);
              params.set("model", row.model.id);
              const active = row.model.id === selected.model.id;
              return (
                <Link key={row.model.id} href={`/app/models?${params}`} className={`block rounded-[18px] border p-4 transition ${active ? "border-blueprint bg-blueprint-bg shadow-sm" : "border-border bg-surface hover:border-blueprint/45"}`} aria-current={active ? "true" : undefined}>
                  <div className="flex items-center justify-between gap-2"><span className="badge">{categoryLabel(row.model.category)}</span><Mono>{((row.artifact.sizeBytes ?? 0) / 1024 / 1024).toFixed(1)} MB</Mono></div>
                  <h3 className="mt-3 font-semibold text-ink">{row.model.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-text-2">{row.model.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">{(row.model.tags as string[]).slice(0, 4).map((tag) => <span key={tag} className="rounded-full bg-surface-muted px-2 py-1 text-[10px] text-text-3">#{tag}</span>)}</div>
                </Link>
              );
            })}
          </aside>
        </div>
      ) : <div className="card p-8 text-center text-sm text-text-2">{t("models.empty")}</div>}
    </div>
  );
}
