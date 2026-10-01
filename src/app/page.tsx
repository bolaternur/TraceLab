// locale-wired
import { UiText } from "@/components/locale-provider";
import Link from "next/link";
import { cookies } from "next/headers";
import { isLocale, translate, type Locale } from "@/lib/i18n";
import { getCurrentUser } from "@/server/auth";
import { PublicNav, PublicFooter } from "@/components/public-chrome";
import { TraceIcon } from "@/components/tracelab/trace-icon";

export const dynamic = "force-dynamic";
const HERO: Record<Locale, { lead: string; why: string; supporting: string }> = {
  en: { lead: "Your robot already tells a story.", why: "Keep the why.", supporting: "Capture builds, tests and decisions from the tools your team already uses — then connect them into evidence you can actually come back to." },
  ru: { lead: "Ваш робот уже рассказывает историю.", why: "Сохраните смысл каждого решения.", supporting: "Фиксируйте сборки, тесты и решения из привычных инструментов команды — и связывайте их в доказательства, к которым можно вернуться позже." },
  kk: { lead: "Роботыңыздың өз тарихы бар.", why: "Неге екенін сақтаңыз.", supporting: "Команда қолданатын құралдардағы құрастыру, сынақ және шешімдерді тіркеп, кейін қайта оралуға болатын инженерлік дәлелдерге байланыстырыңыз." },
};
export default async function LandingPage() {
  const jar = await cookies();
  const raw = jar.get("pt_lang")?.value;
  const locale = isLocale(raw) ? raw : "en";
  const user = await getCurrentUser();
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key);
  const hero = HERO[locale];
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <PublicNav signedIn={!!user} locale={locale} />
      <main id="main">
        <section className="border-b border-border bg-canvas">
          <div className="mx-auto flex min-h-[70svh] max-w-[1200px] flex-col justify-center px-5 py-20 sm:px-7">
            <h1 className="max-w-[950px] text-balance text-[48px] font-semibold leading-[1.04] tracking-[-0.045em] sm:text-[76px]">
              <UiText text={hero.lead} /><span className="mt-3 block text-blueprint"><UiText text={hero.why} /></span>
            </h1>
            <p className="mt-7 max-w-[720px] text-lg leading-8 text-text-2"><UiText text={hero.supporting} /></p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href={user ? "/app" : "/auth?mode=signup"} className="btn btn-primary btn-lg">
                <UiText text={user ? (locale === "ru" ? "Открыть проект" : locale === "kk" ? "Жобаны ашу" : "Open workspace") : t("hero.cta")} /> ↗
              </Link>
              <Link href="/app/models" className="btn btn-lg"><UiText text={locale === "ru" ? "3D-модели" : locale === "kk" ? "3D-модельдер" : "3D models"} /></Link>
            </div>
          </div>
        </section>
        <section id="how" className="mx-auto max-w-[1200px] px-5 py-20 sm:px-7">
          <h2 className="max-w-2xl text-4xl font-semibold tracking-tight"><UiText text="From the first part to the next discovery." /></h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: "cad", title: "Build", copy: "Keep your robot models and revisions together.", href: "/app/models", color: "var(--robot-blue)" },
              { icon: "test", title: "Test", copy: "Record real observations and results from the workshop.", href: "/app/capture", color: "var(--robot-yellow)" },
              { icon: "decision", title: "Remember", copy: "Connect each decision to the materials that explain it.", href: "/app/graph", color: "var(--robot-pink)" },
            ].map((item) => (
              <Link key={item.title} href={item.href} className="robot-feature group relative overflow-hidden rounded-3xl border border-border bg-surface p-7 transition-transform hover:-translate-y-1" style={{ borderTopColor: item.color, borderTopWidth: 3 }}>
                <span style={{ color: item.color }}><TraceIcon name={item.icon} size={34} /></span>
                <h3 className="mt-10 text-2xl font-semibold"><UiText text={item.title} /></h3>
                <p className="mt-3 text-base leading-7 text-text-2"><UiText text={item.copy} /></p>
                <span aria-hidden className="mt-7 block text-2xl" style={{ color: item.color }}>↗</span>
              </Link>
            ))}
          </div>
        </section>
        <section className="px-5 pb-20 sm:px-7">
          <div className="mx-auto max-w-[1150px] rounded-[32px] border border-border bg-[var(--robot-purple)] p-8 sm:p-14">
            <h2 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl"><UiText text="Your project, your evidence" /></h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-text-2"><UiText text="Start with your own photo, model or observation. Your workspace grows with your robot." /></p>
            <Link href={user ? "/app/capture" : "/auth?mode=signup"} className="btn btn-primary mt-8"><UiText text="Start building" /> ↗</Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
