import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { brand } from "@/lib/brand";
import { isLocale, translate, type Locale } from "@/lib/i18n";
import { getCurrentUser } from "@/server/auth";
import { PublicNav, PublicFooter } from "@/components/public-chrome";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { PrototypeRobotViewer } from "@/components/tracelab/prototype-robot-viewer";

export const dynamic = "force-dynamic";

const HERO: Record<Locale, { lead: string; why: string; supporting: string }> = {
  en: {
    lead: "Your robot already tells a story.",
    why: "Keep the why.",
    supporting: "Capture builds, tests and decisions from the tools your team already uses — then connect them into evidence you can actually come back to.",
  },
  ru: {
    lead: "Ваш робот уже рассказывает историю.",
    why: "Сохраните почему.",
    supporting: "Фиксируйте сборки, тесты и решения из привычных инструментов команды — и связывайте их в доказательства, к которым можно вернуться позже.",
  },
  kk: {
    lead: "Роботыңыздың өз тарихы бар.",
    why: "Неге екенін сақтаңыз.",
    supporting: "Команда қолданатын құралдардағы құрастыру, сынақ және шешімдерді тіркеп, кейін қайта оралуға болатын инженерлік дәлелдерге байланыстырыңыз.",
  },
};

export default async function LandingPage() {
  const jar = await cookies();
  const raw = jar.get("pt_lang")?.value;
  const locale = isLocale(raw) ? raw : "en";
  const user = await getCurrentUser();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const hero = HERO[locale];
  const prototypeCopy = locale === "ru"
    ? { label: "Живой прототип", status: "Тестовая модель", builder: "Автор прототипа", inspect: "Интерактивная 3D-модель" }
    : locale === "kk"
      ? { label: "Жанды прототип", status: "Сынақ моделі", builder: "Прототип авторы", inspect: "Интерактивті 3D-модель" }
      : { label: "Live prototype", status: "Test model", builder: "Prototype builder", inspect: "Interactive 3D model" };

  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <PublicNav signedIn={!!user} locale={locale} />
      <main id="main">
        <section className="prototype-hero relative overflow-hidden border-b border-white/10 bg-[#101215] text-white">
          <div className="prototype-noise" aria-hidden />
          <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-[1440px] gap-10 px-5 py-10 sm:px-7 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:px-10 lg:py-12">
            <div className="relative z-10 max-w-[650px]">
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="prototype-kicker"><span className="h-1.5 w-1.5 rounded-full bg-signal" /> {prototypeCopy.label}</span>
                <span className="prototype-kicker text-white/45">RKNP · DARYN</span>
              </div>
              <h1 className="text-balance text-[50px] font-semibold leading-[0.9] tracking-[-0.06em] sm:text-[68px] xl:text-[86px]">
                {hero.lead}
                <span className="mt-2 block text-[#88a0ff]">{hero.why}</span>
              </h1>
              <p className="mt-6 max-w-[610px] text-[16px] leading-7 text-white/58 sm:text-lg">{hero.supporting}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={user ? "/app" : "/auth?mode=signup"} className="prototype-primary-action">
                  {user ? "Open workspace" : t("hero.cta")} <span aria-hidden>↗</span>
                </Link>
                <a href="#prototype-999" className="prototype-secondary-action">Inspect Prototype 999</a>
              </div>
              <div className="mt-9 grid max-w-[600px] grid-cols-3 border-y border-white/10 py-4">
                <div><div className="prototype-stat-label">UNIT</div><div className="prototype-stat-value">999</div></div>
                <div className="border-l border-white/10 pl-4"><div className="prototype-stat-label">STATUS</div><div className="prototype-stat-value text-signal">ACTIVE</div></div>
                <div className="border-l border-white/10 pl-4"><div className="prototype-stat-label">SOURCE</div><div className="prototype-stat-value">OBJ / CAD</div></div>
              </div>
            </div>

            <div id="prototype-999" className="prototype-stage relative min-h-[540px] overflow-hidden sm:min-h-[660px] lg:min-h-[720px]">
              <div className="absolute left-5 top-5 z-10">
                <div className="prototype-stage-label">{prototypeCopy.inspect}</div>
                <div className="mt-1 text-xs text-white/40">DECODE SIMPLE BOT · WEB GLB</div>
              </div>
              <div className="prototype-number" aria-hidden>999</div>
              <PrototypeRobotViewer />
              <div className="prototype-callout left-[6%] top-[31%] hidden sm:block"><span>01</span> DRIVE SYSTEM</div>
              <div className="prototype-callout right-[5%] top-[43%] hidden sm:block"><span>02</span> FRAME ASSEMBLY</div>
              <div className="prototype-callout bottom-[23%] left-[11%] hidden sm:block"><span>03</span> EVIDENCE SOURCE</div>
              <div className="absolute inset-x-4 bottom-4 z-10 flex items-center justify-between gap-3 border-t border-white/10 pt-3 text-[9px] uppercase tracking-[0.15em] text-white/40 sm:inset-x-6">
                <span>{prototypeCopy.status}</span><span>REV 001 · 24.09.2026</span>
              </div>
            </div>
          </div>
          <div className="mx-auto grid max-w-[1440px] gap-3 border-t border-white/10 px-5 py-5 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10">
            <div className="flex items-center gap-3">
              <Image src="/team/prototype-builder.jpeg" alt="Prototype builder" width={48} height={48} priority className="h-12 w-12 rounded-full border border-white/20 object-cover object-[50%_32%] grayscale" />
              <div><div className="text-xs font-semibold">@bolaternur</div><div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-white/40">{prototypeCopy.builder}</div></div>
            </div>
            <div className="text-xs leading-5 text-white/45 lg:max-w-[460px] lg:text-right">Prototype content is temporary. The evidence engine is ready for future robot models, workshop photography and test footage.</div>
          </div>
        </section>

        <section className="border-b border-border-subtle bg-surface">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-7 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
              <div className="max-w-[490px]">
                <span className="trace-meta text-[10px] uppercase text-text-3">01 · The problem</span>
                <h2 className="mt-3 text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Your evidence is everywhere.</h2>
                <p className="mt-4 text-base leading-7 text-text-2">The files usually survive. The reason behind them disappears. A commit knows what changed; CAD knows geometry; a photo knows what existed; a test knows what happened. None of those tools know why the student chose the next move.</p>
              </div>
              <div className="rounded-[28px] border border-border-subtle bg-canvas p-5 sm:p-7">
                <div className="flex flex-wrap gap-2">
                  {["GitHub", "Onshape", "Camera", "CSV", "Workshop memory"].map((source) => <span key={source} className="trace-chip min-h-9 px-3">{source}</span>)}
                </div>
                <div className="my-6 flex items-center gap-3" aria-hidden><div className="h-px flex-1 bg-border-default" /><span className="trace-meta text-[9px] uppercase text-text-3">context gets lost</span><div className="h-px flex-1 bg-border-default" /></div>
                <div className="rounded-[20px] border border-blueprint/20 bg-blueprint-bg px-4 py-4">
                  <div className="flex items-center gap-3"><TraceIcon name="graph" size={20} className="text-blueprint" /><div><div className="text-sm font-semibold text-ink">One connected engineering history</div><div className="mt-0.5 text-xs text-text-2">Source → rationale → test → decision → next iteration</div></div></div>
                </div>
                <div className="mt-3 grid overflow-hidden rounded-[20px] border border-border-subtle bg-surface sm:grid-cols-[150px_1fr]">
                  <div className="relative min-h-[120px] bg-[#111315]">
                    <Image src="/evidence/demo-robot.jpg" alt="Robot intake test evidence" fill sizes="(max-width: 640px) 100vw, 150px" className="object-cover opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
                  </div>
                  <div className="p-4">
                    <div className="trace-meta text-[9px] uppercase text-test">Test record · same procedure</div>
                    <div className="mt-2 text-base font-semibold">20 trials · success 11/20 → 17/20</div>
                    <p className="mt-1.5 text-xs leading-5 text-text-2">The result stays linked to the exact mechanism revision and the student decision it supported.</p>
                    <div className="mt-3"><span className="badge badge-blueprint">Source preserved</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="border-b border-border-subtle">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-7 sm:py-20">
            <span className="trace-meta text-[10px] uppercase text-text-3">02 · Capture</span>
            <div className="mt-3 grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
              <div>
                <h2 className="text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Work normally. Add only what the tools cannot know.</h2>
                <p className="mt-4 max-w-[560px] text-base leading-7 text-text-2">Passive source events arrive without asking students to rewrite the work. On a phone in the workshop, Capture stays one interaction away and saves locally when the network is bad.</p>
                <div className="mt-6 flex flex-wrap gap-2">{["Photo ≤15s", "Problem ≤30s", "Test ≤45s", "Decision ≤45s", "Offline first"].map((x) => <span key={x} className="trace-chip">{x}</span>)}</div>
              </div>
              <div className="rounded-[30px] border border-border-subtle bg-surface p-4 shadow-[0_20px_60px_rgba(17,19,21,0.06)] sm:p-6">
                <div className="trace-meta text-[9px] uppercase text-blueprint">Needs your context</div>
                <p className="mt-2 text-[28px] font-semibold leading-[1.08] tracking-[-0.025em]">Why did you make this change?</p>
                <p className="mt-2 text-sm text-text-2">The source already knows the changed files. Preserve the decision in your own words.</p>
                <div className="mt-5 min-h-[150px] rounded-[22px] border border-blueprint/25 bg-canvas p-4 text-[16px] leading-7 text-text-2">We changed the roller spacing because…</div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-text-3">Student-authored · versioned</span><span className="trace-button trace-button-primary min-h-11 rounded-full px-5">Save context →</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border-subtle bg-surface">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-7 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
              <div>
                <span className="trace-meta text-[10px] uppercase text-text-3">03 · Connect</span>
                <h2 className="mt-3 text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Every iteration becomes traceable.</h2>
                <p className="mt-4 text-base leading-7 text-text-2">Not an activity feed. The timeline shows engineering causality: what changed, what tested it, what the result changed, and which decision survived.</p>
              </div>
              <div className="rounded-[24px] border border-border-subtle bg-canvas p-5 sm:p-7">
                <div className="space-y-0">
                  {[
                    ["source", "GITHUB · 10:14", "Revision 07 captured", "src/intake.ts · 84f2ae"],
                    ["test", "TEST · 13:42", "Intake acceleration test", "8 runs · supported"],
                    ["decision", "DECISION · 14:10", "Keep 36 mm spacing", "linked to T-024"],
                    ["revision", "NEXT · 16:03", "Tune motor ramp", "iteration 08"],
                  ].map(([tone, meta, title, sub], index, arr) => (
                    <div key={title} className="relative grid grid-cols-[28px_1fr] gap-3 pb-5 last:pb-0">
                      {index < arr.length - 1 ? <div className="absolute left-[13px] top-6 h-full w-px bg-border-default" aria-hidden /> : null}
                      <div className="relative z-10 mt-1 grid h-7 w-7 place-items-center rounded-full border border-border-strong bg-surface"><span className={`h-2.5 w-2.5 ${tone === "decision" ? "rotate-45 rounded-[2px] bg-decision" : tone === "test" ? "rotate-45 rounded-[2px] bg-test" : tone === "revision" ? "rounded-[2px] bg-signal" : "rounded-full bg-blueprint"}`} /></div>
                      <div className="rounded-[16px] border border-border-subtle bg-surface px-4 py-3"><div className="trace-meta text-[9px] uppercase text-text-3">{meta}</div><div className="mt-1 text-sm font-semibold">{title}</div><div className="mt-0.5 text-xs text-text-3">{sub}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border-subtle">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-7 sm:py-20">
            <div className="grid gap-12 lg:grid-cols-2">
              <div>
                <span className="trace-meta text-[10px] uppercase text-text-3">04 · Remember</span>
                <h2 className="mt-3 text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Remember why you built it this way.</h2>
                <p className="mt-4 text-base leading-7 text-text-2">Search previous seasons, failures and decisions. Memory answers from project evidence first and cites the objects it used. Missing evidence stays missing instead of becoming a confident hallucination.</p>
                <div className="mt-6 rounded-[22px] border border-border-subtle bg-surface p-4"><div className="text-sm font-medium">Why did we stop using chain intake?</div><div className="mt-3 rounded-[15px] bg-canvas p-3 text-sm leading-6 text-text-2">After Test T-019 showed repeated chain derailment under side load, Decision D-011 rejected that revision. <span className="badge badge-blueprint ml-1">test ↗</span> <span className="badge badge-decision ml-1">decision ↗</span></div></div>
              </div>
              <div>
                <span className="trace-meta text-[10px] uppercase text-text-3">05 · Trust</span>
                <h2 className="mt-3 text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Evidence without replacing student thinking.</h2>
                <p className="mt-4 text-base leading-7 text-text-2">Competition policy is a visible system state. Student rationale, source facts, coach notes and AI output never collapse into one anonymous text blob.</p>
                <div className="mt-6 space-y-2">{["Student-authored rationale remains versioned", "Original source events stay immutable", "AI actions are policy-gated and labeled", "Private by default for student teams", "Exports keep provenance internally"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-[14px] border border-border-subtle bg-surface px-3.5 py-3 text-sm"><span className={`grid h-7 w-7 place-items-center rounded-full ${index === 2 ? "bg-signal-soft text-ink" : "bg-success-bg text-success"}`}>{index === 2 ? "!" : "✓"}</span>{item}</div>)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border-subtle bg-surface">
          <div className="mx-auto max-w-[1200px] px-5 py-16 sm:px-7 sm:py-20">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr] lg:items-center">
              <div>
                <span className="trace-meta text-[10px] uppercase text-text-3">06 · Reuse</span>
                <h2 className="mt-3 text-balance text-[36px] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">One evidence base. Many outputs.</h2>
                <p className="mt-4 max-w-[620px] text-base leading-7 text-text-2">Competition portfolio, notebook view, season handoff, interview evidence and coach process health should all derive from the same source-linked engineering history — not five duplicated documents.</p>
                <div className="mt-6 flex flex-wrap gap-2">{["Portfolio", "Notebook view", "Handoff", "Interview evidence", "Coach process health"].map((item) => <span key={item} className="trace-chip min-h-9 px-3">{item}</span>)}</div>
              </div>
              <div className="rounded-[26px] border border-border-subtle bg-canvas p-5 sm:p-6"><div className="trace-meta text-[9px] uppercase text-text-3">Next season · resurfaced evidence</div><p className="mt-3 text-xl font-semibold leading-7">“We already tested this idea last year.”</p><p className="mt-3 text-sm leading-6 text-text-2">A failed mechanism is useful when the next team can recover the exact revision, test conditions and student conclusion instead of repeating the same experiment from memory.</p><div className="mt-5 flex items-center gap-2"><TraceIcon name="memory" size={17} className="text-blueprint" /><span className="text-sm font-medium text-blueprint">Open prior-season trace →</span></div></div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-7 sm:py-28">
          <div className="mx-auto max-w-[1000px] overflow-hidden rounded-[32px] border border-border-subtle bg-ink px-6 py-10 text-white sm:px-10 sm:py-14">
            <div className="trace-meta text-[10px] uppercase text-white/55">Build · Test · Decide · Remember</div>
            <h2 className="mt-3 max-w-[700px] text-balance text-[40px] font-semibold leading-[1] tracking-[-0.04em] sm:text-[56px]">Preserve how the engineering actually happened.</h2>
            <p className="mt-5 max-w-[650px] text-base leading-7 text-white/68">Start private. Capture real work. Ask students only for the missing why. Let the evidence become useful before judging week.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href={user ? "/app" : "/auth?mode=signup"} className="trace-button trace-button-expressive min-w-[170px] rounded-full border-white bg-white px-6 text-ink hover:bg-white/90">{user ? "Open workspace" : "Start a private team"} →</Link><Link href="/trust" className="trace-button min-h-13 rounded-full border-white/25 bg-white/5 px-5 text-white hover:bg-white/10">Trust &amp; safety</Link></div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
