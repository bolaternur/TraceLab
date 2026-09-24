import { cookies } from "next/headers";
import Link from "next/link";
import { PublicFooter, PublicNav } from "@/components/public-chrome";
import { getCurrentUser } from "@/server/auth";
import { isLocale, type Locale } from "@/lib/i18n";

const COPY: Record<Locale, { eyebrow:string; title:string; body:string; question:string; hypothesis:string; protocol:string; metrics:string[]; integrity:string; cta:string }> = {
  en: {
    eyebrow:"TraceLab · Research protocol",
    title:"The product is only valuable if it measurably improves engineering memory.",
    body:"TraceLab is designed as an experimentally testable engineering system, not just a notebook interface. The competition study compares a team's normal fragmented workflow with the same workflow plus TraceLab's provenance layer.",
    question:"Can passive provenance capture plus short student-authored rationale reduce documentation effort while improving retrieval of engineering decisions and supporting evidence?",
    hypothesis:"Teams using TraceLab will retrieve prior decisions and tests faster, link a larger share of decisions to evidence, and spend less manual time reconstructing project history.",
    protocol:"Measure the same teams before and after adoption during real build–test–decision cycles. Keep the underlying tools unchanged so the independent variable is the TraceLab evidence layer.",
    metrics:["Time to retrieve an old design decision", "Time to find the supporting test", "Decision evidence-link rate", "Manual documentation time per meaningful change", "Share of active members contributing evidence", "Portfolio/evidence preparation time"],
    integrity:"No improvement figures are pre-filled or fabricated. Pilot results must be measured from real teams and reported with sample size, dates and limitations.",
    cta:"See the product demo",
  },
  ru: {
    eyebrow:"TraceLab · Протокол исследования",
    title:"Проект имеет ценность только тогда, когда измеримо улучшает инженерную память.",
    body:"TraceLab строится как проверяемая инженерная система, а не просто интерфейс электронного дневника. Исследование сравнивает обычный разрозненный процесс команды с теми же инструментами, дополненными слоем provenance TraceLab.",
    question:"Может ли пассивный сбор цифровых следов вместе с коротким объяснением ученика уменьшить затраты на документацию и ускорить поиск инженерных решений и подтверждающих доказательств?",
    hypothesis:"Команды с TraceLab будут быстрее находить прошлые решения и тесты, связывать больше решений с доказательствами и тратить меньше времени на восстановление истории проекта вручную.",
    protocol:"Измерить одни и те же команды до и после внедрения во время реальных циклов разработка–тест–решение. Основные инструменты команды не менять, чтобы независимой переменной оставался evidence layer TraceLab.",
    metrics:["Время поиска старого инженерного решения", "Время поиска подтверждающего теста", "Доля решений, связанных с доказательствами", "Время ручной документации одного значимого изменения", "Доля активных участников, создающих evidence", "Время подготовки портфолио/доказательств"],
    integrity:"Никакие показатели улучшения заранее не подставляются и не выдумываются. Результаты пилота должны быть получены на реальных командах с указанием выборки, дат и ограничений.",
    cta:"Посмотреть демо продукта",
  },
  kk: {
    eyebrow:"TraceLab · Зерттеу хаттамасы",
    title:"Жоба инженерлік жадты өлшенетін түрде жақсартқанда ғана құнды.",
    body:"TraceLab жай электрондық дәптер интерфейсі емес, эксперимент арқылы тексерілетін инженерлік жүйе ретінде жасалған. Зерттеу команданың қалыпты шашыраңқы жұмысын сол құралдарға TraceLab provenance қабатын қосқан жағдаймен салыстырады.",
    question:"Пассивті provenance жинау және оқушының қысқа түсіндірмесі құжаттау уақытын азайтып, инженерлік шешімдер мен дәлелдерді табуды жақсарта ала ма?",
    hypothesis:"TraceLab қолданған командалар бұрынғы шешімдер мен сынақтарды жылдамырақ табады, шешімдердің көбірек бөлігін дәлелмен байланыстырады және тарихты қолмен қалпына келтіруге аз уақыт жұмсайды.",
    protocol:"Нақты құрастыру–сынақ–шешім циклдерінде бір командаларды енгізуге дейін және кейін өлшеу. Негізгі құралдарды өзгертпеу керек, тәуелсіз айнымалы TraceLab evidence layer болып қалады.",
    metrics:["Ескі инженерлік шешімді табу уақыты", "Қолдаушы сынақты табу уақыты", "Дәлелмен байланысқан шешімдер үлесі", "Бір маңызды өзгерісті қолмен құжаттау уақыты", "Evidence қосқан белсенді мүшелер үлесі", "Портфолио/дәлел дайындау уақыты"],
    integrity:"Жақсару көрсеткіштері алдын ала толтырылмайды және ойдан шығарылмайды. Пилот нәтижелері нақты командалардан, іріктеме көлемі, күндер және шектеулермен бірге өлшенуі тиіс.",
    cta:"Өнім демосын көру",
  },
};

export default async function ResearchPage() {
  const jar = await cookies();
  const raw = jar.get("pt_lang")?.value;
  const locale = isLocale(raw) ? raw : "en";
  const user = await getCurrentUser();
  const c = COPY[locale];
  return <div className="min-h-dvh bg-canvas text-ink"><PublicNav signedIn={Boolean(user)} locale={locale}/><main id="main">
    <section className="border-b border-border-subtle"><div className="mx-auto max-w-[1180px] px-5 py-16 sm:px-7 sm:py-20"><div className="trace-meta text-[10px] uppercase text-text-3">{c.eyebrow}</div><h1 className="mt-3 max-w-[980px] text-balance text-[42px] font-semibold leading-[1] tracking-[-0.045em] sm:text-[60px]">{c.title}</h1><p className="mt-6 max-w-[820px] text-base leading-7 text-text-2 sm:text-lg">{c.body}</p></div></section>
    <section className="mx-auto grid max-w-[1180px] gap-4 px-5 py-10 sm:px-7 lg:grid-cols-2">
      <article className="evidence-card p-6" data-tone="source"><div className="trace-meta text-[9px] uppercase text-text-3">Research question</div><p className="mt-3 text-xl font-semibold leading-8">{c.question}</p></article>
      <article className="evidence-card p-6" data-tone="verified"><div className="trace-meta text-[9px] uppercase text-text-3">Hypothesis</div><p className="mt-3 text-base leading-7 text-text-2">{c.hypothesis}</p></article>
      <article className="evidence-card p-6 lg:col-span-2" data-tone="test"><div className="trace-meta text-[9px] uppercase text-text-3">Experimental design</div><p className="mt-3 max-w-[900px] text-base leading-7 text-text-2">{c.protocol}</p><div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{c.metrics.map((metric,index)=><div key={metric} className="rounded-[14px] border border-border bg-canvas p-3"><span className="font-mono text-[9px] text-text-3">M{String(index+1).padStart(2,"0")}</span><div className="mt-1 text-sm font-semibold">{metric}</div></div>)}</div></article>
      <article className="rounded-[20px] border border-verified-green/20 bg-verified-green/5 p-6 lg:col-span-2"><div className="trace-meta text-[9px] uppercase text-verified-green">Research integrity</div><p className="mt-3 max-w-[900px] text-sm leading-6 text-text-2">{c.integrity}</p></article>
      <div className="lg:col-span-2"><Link href="/showcase" className="trace-button trace-button-primary min-h-12 rounded-full px-5">{c.cta} →</Link></div>
    </section>
  </main><PublicFooter/></div>;
}
