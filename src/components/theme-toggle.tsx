"use client";

import { useEffect, useRef } from "react";
import { mountThemeToggle } from "../../website/tracelab/theme-toggle.js";

const labels = { ru: "Молочная тема", en: "Milk theme", kk: "Сүт түсті тақырып" };

/** The shared native controller changes appearance without remounting the form. */
export function ThemeToggle({ locale = "ru" }: { locale?: string }) {
  const chosen = locale === "en" || locale === "kk" ? locale : "ru";
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!button.current) return;
    const control = mountThemeToggle(button.current, { locale: () => chosen });
    return () => control.dispose();
  }, [chosen]);

  return <button ref={button} className="iz-theme-toggle" data-theme-toggle type="button" role="switch" aria-checked={false} aria-label={labels[chosen]}>
    <span className="iz-theme-glyph" aria-hidden="true">
      <svg className="iz-theme-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></svg>
      <svg className="iz-theme-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false"><path d="M20.5 13.2A8.7 8.7 0 0 1 10.8 3.5 8.7 8.7 0 1 0 20.5 13.2Z"/></svg>
    </span>
  </button>;
}
