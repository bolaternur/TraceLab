"use client";

import { useEffect, useMemo, useState } from "react";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import type { Locale } from "@/lib/i18n";

type DemoStep = {
  kind: string;
  label: string;
  title: string;
  detail: string;
  evidence: string;
  icon: string;
  tone: "source" | "revision" | "test" | "decision" | "verified";
};

const STEPS: Record<Locale, DemoStep[]> = {
  en: [
    { kind: "01", label: "Source", title: "Roller spacing changed 32 → 36 mm", detail: "GitHub/CAD revision arrives automatically. Author, time and original source stay attached.", evidence: "REV 23 · source preserved", icon: "cad", tone: "source" },
    { kind: "02", label: "Student why", title: "Fast intake kept wedging the game piece", detail: "The student adds only the missing engineering reason. TraceLab does not rewrite it with generative AI.", evidence: "student-authored · versioned", icon: "reflection", tone: "revision" },
    { kind: "03", label: "Test", title: "20 trials · success 11/20 → 17/20", detail: "The measurement is linked to the exact revision it tested, including procedure and outcome.", evidence: "same procedure · quantitative evidence", icon: "test", tone: "test" },
    { kind: "04", label: "Decision", title: "Keep the 36 mm spacing", detail: "The decision points back to its supporting test, source revision and student rationale.", evidence: "шешім → қолдаушы сынақ", icon: "decision", tone: "decision" },
    { kind: "05", label: "Why?", title: "Why are the rollers 36 mm apart?", detail: "Deterministic retrieval follows stored relations and returns the decision, test and student rationale instead of inventing an answer.", evidence: "source-cited memory", icon: "memory", tone: "verified" },
    { kind: "06", label: "Next season", title: "The reason survives the team", detail: "A new member can recover what was tried, what failed and why the mechanism ended up this way.", evidence: "cross-season engineering memory", icon: "handoff", tone: "verified" },
  ],
  ru: [
    { kind: "01", label: "Источник", title: "Расстояние между роликами 32 → 36 мм", detail: "Изменение из GitHub/CAD поступает автоматически. Автор, время и исходный источник сохраняются.", evidence: "REV 23 · источник сохранён", icon: "cad", tone: "source" },
    { kind: "02", label: "Почему", title: "На высокой скорости игровой элемент заклинивало", detail: "Ученик добавляет только инженерную причину, которой нет в исходных файлах. TraceLab не переписывает её генеративным ИИ.", evidence: "написано учеником · версия сохранена", icon: "reflection", tone: "revision" },
    { kind: "03", label: "Тест", title: "20 попыток · успех 11/20 → 17/20", detail: "Измерение связывается именно с той версией конструкции, которую проверяли, вместе с процедурой и результатом.", evidence: "одинаковая процедура · количественное доказательство", icon: "test", tone: "test" },
    { kind: "04", label: "Решение", title: "Оставить расстояние 36 мм", detail: "Решение связано с тестом, исходной ревизией и объяснением ученика.", evidence: "шешім → қолдаушы сынақ", icon: "decision", tone: "decision" },
    { kind: "05", label: "Why?", title: "Почему ролики расположены на 36 мм?", detail: "TraceLab проходит по сохранённым связям и показывает решение, тест и объяснение ученика вместо выдуманного ответа.", evidence: "память с источниками", icon: "memory", tone: "verified" },
    { kind: "06", label: "Следующий сезон", title: "Причина не исчезает вместе с участником", detail: "Новый член команды видит, что уже пробовали, что не сработало и почему механизм стал именно таким.", evidence: "инженерная память между сезонами", icon: "handoff", tone: "verified" },
  ],
  kk: [
    { kind: "01", label: "Дереккөз", title: "Ролик аралығы 32 → 36 мм", detail: "GitHub/CAD өзгерісі автоматты түрде түседі. Автор, уақыт және бастапқы дереккөз сақталады.", evidence: "REV 23 · дереккөз сақталған", icon: "cad", tone: "source" },
    { kind: "02", label: "Неліктен", title: "Жоғары жылдамдықта ойын элементі кептелді", detail: "Оқушы файлдарда жоқ инженерлік себепті ғана қосады. TraceLab оны генеративті AI арқылы қайта жазбайды.", evidence: "оқушы жазған · нұсқаланған", icon: "reflection", tone: "revision" },
    { kind: "03", label: "Сынақ", title: "20 сынақ · нәтиже 11/20 → 17/20", detail: "Өлшем нақты сыналған нұсқамен, процедурамен және нәтижемен байланыстырылады.", evidence: "бірдей процедура · сандық дәлел", icon: "test", tone: "test" },
    { kind: "04", label: "Шешім", title: "36 мм аралықты сақтау", detail: "Шешім қолдаушы сынаққа, бастапқы ревизияға және оқушы түсіндірмесіне байланысады.", evidence: "шешім → қолдаушы сынақ", icon: "decision", tone: "decision" },
    { kind: "05", label: "Why?", title: "Неліктен роликтер 36 мм аралықта?", detail: "TraceLab сақталған байланыстар арқылы шешім, сынақ және оқушы түсіндірмесін көрсетеді; жауапты ойдан шығармайды.", evidence: "дереккөзге сүйенген жад", icon: "memory", tone: "verified" },
    { kind: "06", label: "Келесі маусым", title: "Себеп командадан кетіп қалмайды", detail: "Жаңа қатысушы бұрын не сыналғанын, не сәтсіз болғанын және механизмнің неге осындай болғанын көре алады.", evidence: "маусымаралық инженерлік жад", icon: "handoff", tone: "verified" },
  ],
};

export function ShowcaseReplay({ locale }: { locale: Locale }) {
  const steps = useMemo(() => STEPS[locale], [locale]);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (active >= steps.length - 1) {
        setPlaying(false);
        return;
      }
      setActive(active + 1);
    }, 1450);
    return () => window.clearTimeout(timer);
  }, [active, playing, steps.length]);

  const step = steps[active];
  const playLabel = locale === "ru" ? (playing ? "Пауза" : "Проиграть") : locale === "kk" ? (playing ? "Кідірту" : "Ойнату") : (playing ? "Pause" : "Play replay");
  const demoLabel = locale === "ru" ? "Демо-данные · не результаты пилота" : locale === "kk" ? "Демо-деректер · пилот нәтижесі емес" : "Demo dataset · not pilot results";

  return (
    <section className="showcase-replay" aria-label="TraceLab engineering evidence replay">
      <div className="showcase-replay-head">
        <div>
          <div className="trace-meta text-[9px] uppercase text-white/40">Trace Replay · 60 second demo</div>
          <div className="mt-1 text-xs text-white/55">{demoLabel}</div>
        </div>
        <button type="button" className="showcase-replay-play" data-active={playing ? "true" : "false"} onClick={() => { if (!playing && active === steps.length - 1) setActive(0); setPlaying((value) => !value); }}>
          <span aria-hidden>{playing ? "Ⅱ" : "▶"}</span>{playLabel}
        </button>
      </div>

      <div className="showcase-replay-stage">
        <div className="showcase-replay-progress" aria-hidden>
          {steps.map((candidate, index) => <span key={candidate.kind} data-state={index < active ? "done" : index === active ? "active" : "future"} />)}
        </div>
        <article className="showcase-replay-card" data-tone={step.tone}>
          <div className="showcase-replay-glyph"><TraceIcon name={step.icon} size={24} /></div>
          <div className="min-w-0 flex-1">
            <div className="trace-meta text-[9px] uppercase text-black/36">{step.kind} · {step.label}</div>
            <h2 className="mt-2 text-balance text-[28px] font-semibold leading-[1.08] tracking-[-0.035em] text-[#111315] sm:text-[34px]">{step.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-black/52 sm:text-[15px]">{step.detail}</p>
            <div className="mt-5 inline-flex min-h-8 items-center rounded-full border border-black/8 bg-black/[0.025] px-3 font-mono text-[9px] uppercase tracking-[0.05em] text-black/42">{step.evidence}</div>
          </div>
        </article>
      </div>

      <div className="showcase-replay-nav" aria-label="Replay steps">
        {steps.map((candidate, index) => (
          <button key={candidate.kind} type="button" data-active={index === active ? "true" : "false"} onClick={() => { setPlaying(false); setActive(index); }} aria-label={`${candidate.kind} ${candidate.label}`}>
            <span>{candidate.kind}</span><strong>{candidate.label}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
