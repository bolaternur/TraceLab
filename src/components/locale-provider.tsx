"use client";
import { createContext, createElement, useContext, type ReactNode, type JSX } from "react";
import type { Locale } from "@/lib/i18n";
import { uiPhrase } from "@/lib/ui-phrases";

const LocaleContext = createContext<Locale>("en");
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}
export function useUiText() {
  const locale = useContext(LocaleContext);
  return (text: string) => uiPhrase(text, locale);
}
export function UiText({ text }: { text: ReactNode }) {
  const t = useUiText();
  return <>{typeof text === "string" ? t(text) : text}</>;
}
// Source-level localization for native labels, placeholders and accessibility text.
export function UiElement<T extends keyof JSX.IntrinsicElements>({ as, children, ...props }: { as: T } & JSX.IntrinsicElements[T]) {
  const t = useUiText();
  const localized: Record<string, unknown> = { ...props };
  for (const key of ["placeholder", "title", "aria-label", "alt"]) {
    if (typeof localized[key] === "string") localized[key] = t(localized[key] as string);
  }
  return createElement(as, localized, children);
}
