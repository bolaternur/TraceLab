"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup, NavItem } from "@/components/nav";
import { TraceMark } from "@/components/tracelab/brand-mark";
import { CommandPalette } from "@/components/tracelab/command-palette";
import { TraceIcon } from "@/components/tracelab/trace-icon";

interface ToolRailProps {
  groups: NavGroup[];
  today: NavItem;
  capture: NavItem;
}

const RAIL_ROUTES = [
  { href: "/app", glyph: "today", fallback: "Workbench", exact: true },
  { href: "/app/capture", glyph: "capture", fallback: "Capture" },
  { href: "/app/timeline", glyph: "timeline", fallback: "Timeline" },
  { href: "/app/graph", glyph: "graph", fallback: "Trace" },
  { href: "/app/exports", glyph: "export", fallback: "Outputs" },
  { href: "/app/settings", glyph: "settings", fallback: "Settings" },
] as const;

function routeActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function ToolRail({ groups, today, capture }: ToolRailProps) {
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
        {RAIL_ROUTES.slice(0, 4).map((item) => {
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
        {RAIL_ROUTES.slice(4).map((item) => {
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
