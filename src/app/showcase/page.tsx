import { cookies } from "next/headers";
import Link from "next/link";
import { PublicFooter, PublicNav } from "@/components/public-chrome";
import { ShowcaseReplay } from "@/components/tracelab/showcase-replay";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { getCurrentUser } from "@/server/auth";
import { isLocale, type Locale } from "@/lib/i18n";

const COPY: Record<Locale, { eyebrow: string; title: string; body: string; research: string; workspace: string; pillars: Array<[string,string]> }> = {
  en: {
    eyebrow: "TraceLab · Judge showcase",
    title: "See an engineering decision become evidence.",
    body: "A one-minute walkthrough of the core TraceLab idea: preserve the source, ask the student for the missing why, connect the test, keep the decision, and make the reasoning retrievable months later.",
    research: "Research method",
    workspace: "Open workspace",
    pillars: [["Source truth", "Code, CAD, photos and tests keep their original provenance."], ["Student ownership", "Human rationale is explicitly student-authored and versioned."], ["Engineering memory", "Why? retrieves linked evidence instead of inventing a story."]],
  },
  ru: {
    eyebrow: "TraceLab · Демо для жюри",
    title: "Посмотрите, как инженерное решение превращается в доказательство.",
    body: "За одну минуту видно всю идею TraceLab: сохранить источник, получить от ученика недостающее почему, связать тест и решение и сделать инженерную логику доступной спустя месяцы.",
    research: "Метод исследования",
    workspace: "Открыть проект",
    pillars: [["Правда источника", "Код, CAD, фотографии и тесты сохраняют происхождение."], ["Авторство ученика", "Инженерное объяснение явно принадлежит ученику и версионируется."], ["Инженерная память", "Why? находит связанные доказательства, а не придумывает историю."]],
  },
  kk: {
    eyebrow: "TraceLab · Қазыларға арналған демо",
    title: "Инженерлік шешімнің дәлелге қалай айналатынын көріңіз.",
    body: "Бір минутта TraceLab идеясы толық көрінеді: дереккөзді сақтау, оқушыдан жетіспейтін неліктенін алу, сынақ пен шешімді байланыстыру және инженерлік логиканы айлар өткен соң да табу.",
    research: "Зерттеу әдісі",
    workspace: "Жобаны ашу",
    pillars: [["Дереккөз ақиқаты", "Код, CAD, фото және сынақ бастапқы provenance-пен сақталады."], ["Оқушы авторлығы", "Инженерлік түсіндірме оқушыға тиесілі және нұсқаланады."], ["Инженерлік жад", "Why? тарихты ойдан шығармай, байланысты дәлелдерді табады."]],
  },
};

export default async function ShowcasePage() {
  const jar = await cookies();
  const raw = jar.get("pt_lang")?.value;
  const locale = isLocale(raw) ? raw : "en";
  const user = await getCurrentUser();
  const copy = COPY[locale];
  return (
    <div className="min-h-dvh bg-[#17181a] text-white">
      <PublicNav signedIn={Boolean(user)} locale={locale} />
      <main id="main">
        <section className="mx-auto max-w-[1280px] px-5 pb-10 pt-12 sm:px-7 sm:pt-16">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
            <div>
              <div className="trace-meta text-[10px] uppercase text-white/38">{copy.eyebrow}</div>
              <h1 className="mt-3 max-w-[760px] text-balance text-[46px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[62px]">{copy.title}</h1>
            </div>
            <div className="lg:pb-1">
              <p className="max-w-[620px] text-base leading-7 text-white/58">{copy.body}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/research" className="trace-button min-h-11 rounded-full border-white/12 bg-white/[0.04] px-4 text-white hover:bg-white/[0.08]"><TraceIcon name="test" size={16} /> {copy.research}</Link>
                <Link href={user ? "/app" : "/auth?mode=signup"} className="trace-button min-h-11 rounded-full bg-white px-4 text-[#111315]">{copy.workspace} →</Link>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-[1280px] px-5 pb-14 sm:px-7"><ShowcaseReplay locale={locale} /></section>
        <section className="border-y border-white/8 bg-white/[0.025]">
          <div className="mx-auto grid max-w-[1280px] gap-px px-5 py-10 sm:grid-cols-3 sm:px-7">
            {copy.pillars.map(([title, body], index) => <article key={title} className="border-white/8 py-5 sm:px-6 sm:first:pl-0 sm:border-l sm:first:border-l-0"><span className="font-mono text-[9px] text-white/26">0{index + 1}</span><h2 className="mt-3 text-lg font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-white/48">{body}</p></article>)}
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
