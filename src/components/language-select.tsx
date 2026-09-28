"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_LABELS, translate, type Locale } from "@/lib/i18n";
import { setLocale } from "@/server/actions";

/** Shared by public pages, the desktop rail, mobile navigation and settings. */
export function LanguageSelect({ locale, compact = false }: { locale: Locale; compact?: boolean }) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{translate(locale, "common.language")}</label>
      <select
        id={id}
        value={locale}
        disabled={pending}
        aria-busy={pending}
        className={compact ? "h-11 w-10 rounded-lg border border-white/20 bg-[#181b1d] text-center text-[10px] text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blueprint" : "select !min-h-11 !w-auto"}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setFailed(false);
          startTransition(async () => {
            try {
              const form = new FormData();
              form.set("locale", next);
              await setLocale(form);
              router.refresh();
            } catch {
              setFailed(true);
            }
          });
        }}
      >
        {LOCALES.map((item) => <option key={item} value={item} lang={item}>{compact ? item.toUpperCase() : LOCALE_LABELS[item]}</option>)}
      </select>
      <span role="status" className={failed ? "block text-xs text-danger" : "sr-only"}>
        {failed ? translate(locale, "common.saveFailed") : pending ? translate(locale, "common.saving") : ""}
      </span>
    </div>
  );
}
