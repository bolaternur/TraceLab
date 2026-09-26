"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup, NavItem } from "@/components/nav";
import { TraceMark } from "@/components/tracelab/brand-mark";
import { CommandPalette } from "@/components/tracelab/command-palette";
import { TraceIcon } from "@/components/tracelab/trace-icon";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";
import { setLocale } from "@/server/actions";

interface ToolRailProps {
  groups: NavGroup[];
  today: NavItem;
  capture: NavItem;
  locale: Locale;
}

const RAIL_ROUTES = [
  { href: "/app", glyph: "today", fallback: "Workbench", exact: true },
  { href: "/app/capture", glyph: "capture", fallback: "Capture" },
  { href: "/app/timeline", glyph: "timeline", fallback: "Timeline" },
  { href: "/app/graph", glyph: "graph", fallback: "Trace" },
  { href: "/app/models", glyph: "cad", fallback: "3D Models" },
  { href: "/app/exports", glyph: "export", fallback: "Outputs" },
  { href: "/app/settings", glyph: "settings", fallback: "Settings" },
] as const;

function routeActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function LanguageSwitcher({ locale }: { locale: Locale }) {
  const nextLocale = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
  return (
    <form action={setLocale} className="workbench-language-switcher">
      <button
        type="submit"
        name="locale"
        value={nextLocale}
        className="workbench-rail-action"
        aria-label={`Change language to ${LOCALE_LABELS[nextLocale]}`}
        title={`${LOCALE_LABELS[locale]} → ${LOCALE_LABELS[nextLocale]}`}
      >
        <span className="mono text-[10px] font-semibold tracking-[0.08em]">{locale.toUpperCase()}</span>
      </button>
    </form>
  );
}

export function ToolRail({ groups, today, capture, locale }: ToolRailProps) {
  const pathname = usePathname();
  const labels = new Map<string, string>([
    [today.href, today.label],
    [capture.href, capture.label],
    ...groups.flatMap((group) => group.items.map((item) => [item.href, item.label] as const)),
  ]);

  return (
    <aside className="workbench-tool-rail hidden md:flex" aria-label="Spatial workspace tools">
      <Link href="/app" className="workbench-rail-mark" aria-label="TraceLab workbench" title="Workbench">
        <TraceMark className="h-7 w-7" />
      </Link>

      <nav className="workbench-rail-nav" aria-label="Primary workspace">
        {RAIL_ROUTES.slice(0, 5).map((item) => {
          const active = routeActive(pathname, item.href, "exact" in item ? item.exact : false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="workbench-rail-action"
              data-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
              data-spatial-route={item.href === "/app" || item.href === "/app/timeline" || item.href === "/app/graph" ? "true" : undefined}
              aria-label={labels.get(item.href) ?? item.fallback}
              title={labels.get(item.href) ?? item.fallback}
            >
              <TraceIcon name={item.glyph} size={19} />
            </Link>
          );
        })}

        <CommandPalette groups={groups} today={today} capture={capture} compact />
      </nav>

      <nav className="workbench-rail-nav mt-auto" aria-label="Workspace utilities">
        <LanguageSwitcher locale={locale} />
        {RAIL_ROUTES.slice(5).map((item) => {
          const active = routeActive(pathname, item.href, "exact" in item ? item.exact : false);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="workbench-rail-action"
              data-active={active ? "true" : "false"}
              aria-current={active ? "page" : undefined}
              data-spatial-route={item.href === "/app" || item.href === "/app/timeline" || item.href === "/app/graph" ? "true" : undefined}
              aria-label={labels.get(item.href) ?? item.fallback}
              title={labels.get(item.href) ?? item.fallback}
            >
              <TraceIcon name={item.glyph} size={19} />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
