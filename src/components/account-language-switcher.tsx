"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import "../../website/tracelab/language-switcher.css";

type Locale = "ru" | "en" | "kk";
const locales = ["ru", "en", "kk"] as const;
const names = { ru: "Русский", en: "English", kk: "Қазақша" };
const labels = {
  ru: { language: "Язык интерфейса", choose: "Выбрать язык", ru: "Русский", en: "Английский", kk: "Казахский" },
  en: { language: "Interface language", choose: "Choose language", ru: "Russian", en: "English", kk: "Kazakh" },
  kk: { language: "Интерфейс тілі", choose: "Тілді таңдау", ru: "Орысша", en: "Ағылшынша", kk: "Қазақша" },
};

/** The account form keeps its own controlled locale and persistence. */
export function AccountLanguageSwitcher({ locale, onChange }: { locale: Locale; onChange: (value: Locale) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const openingIndex = useRef<number | null>(null);
  const copy = labels[locale];

  useEffect(() => {
    document.documentElement.lang = locale;
    const skip = document.querySelector<HTMLAnchorElement>("a.skip-link[href='#main']");
    if (skip) skip.textContent = { ru: "Перейти к содержимому", en: "Skip to content", kk: "Мазмұнға өту" }[locale];
  }, [locale]);

  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function show(index = locales.indexOf(locale)) {
    openingIndex.current = index;
    setOpen(true);
  }
  function choose(value: Locale) {
    close(true);
    if (value !== locale) onChange(value);
  }

  useEffect(() => {
    if (!open) return;
    const options = panel.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]");
    options?.[openingIndex.current ?? locales.indexOf(locale)]?.focus();
    openingIndex.current = null;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open, locale]);

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (event.key === "Tab") { close(); return; }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      show(event.key === "End" || event.key === "ArrowUp" ? locales.length - 1 : event.key === "Home" ? 0 : locales.indexOf(locale));
      return;
    }
    const options = [...(panel.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? [])];
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (current + (event.key === "ArrowDown" ? 1 : options.length - 1)) % options.length;
    options[next]?.focus();
  }

  return <div ref={root} className="iz-language" data-open={String(open)} onKeyDown={handleKeys}>
    <button ref={trigger} className="iz-language-trigger" type="button" data-language-trigger aria-label={`${copy.choose}: ${names[locale]}`} aria-haspopup="menu" aria-expanded={open} aria-controls={`${id}-languages`} onClick={() => open ? close() : show()}>
      <svg className="iz-language-globe" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 4 6 4 9s-1 6-4 9c-3-3-4-6-4-9s1-6 4-9Z"/></svg>
      <span className="iz-language-code" key={locale}>{locale.toUpperCase()}</span>
      <svg className="iz-language-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
    </button>
    <div ref={panel} id={`${id}-languages`} className="iz-language-panel" data-language-panel role="menu" aria-label={copy.language} hidden={!open}>
      <p className="iz-language-heading" data-language-heading>{copy.language}</p>
      {locales.map(value => <button type="button" key={value} className="iz-language-option" data-locale={value} role="menuitemradio" aria-checked={locale === value} tabIndex={-1} onClick={() => choose(value)}>
        <span className="iz-language-option-code" aria-hidden="true">{value.toUpperCase()}</span>
        <span className="iz-language-text"><span className="iz-language-name" lang={value}>{names[value]}</span><span className="iz-language-hint" hidden={copy[value] === names[value]}>{copy[value]}</span></span>
        <svg className="iz-language-check" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>
      </button>)}
    </div>
  </div>;
}
