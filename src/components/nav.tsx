"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { TraceIcon } from "@/components/tracelab/trace-icon";

export interface NavItem {
  href: string;
  label: string;
  glyph: string;
  exact?: boolean;
  badge?: number;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

function isActive(path: string, item: NavItem) {
  return item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");
}

export function NavLinkItem({ item, onNavigate, prominent = false }: { item: NavItem; onNavigate?: () => void; prominent?: boolean }) {
  const path = usePathname();
  const active = isActive(path, item);
  return (
    <Link
      href={item.href}
      className={prominent ? `nav-link ${active ? "!bg-blueprint-bg !text-blueprint" : ""}` : "nav-link"}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
    >
      <TraceIcon name={item.glyph} size={18} className={active ? "text-blueprint" : "text-text-3"} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.badge ? <span className="badge badge-blueprint">{item.badge}</span> : null}
    </Link>
  );
}

export function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.title}>
          <div className="trace-meta mb-1.5 px-2 text-[10px] font-semibold uppercase text-text-3">{group.title}</div>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <NavLinkItem item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function MobileNav({ groups, teamName, primary, capture, canCapture }: { groups: NavGroup[]; teamName: string; primary: NavItem[]; capture: NavItem; canCapture: boolean }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const captureOnCanvas = path === "/app";
  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between border-b border-border bg-canvas/92 px-4 backdrop-blur-xl md:hidden">
        <div className="min-w-0">
          <div className="trace-meta text-[9px] uppercase text-text-3">Workspace</div>
          <span className="block truncate text-sm font-semibold">{teamName}</span>
        </div>
        <button
          className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close navigation" : "Open navigation"}
          onClick={() => setOpen((value) => !value)}
        >
          <TraceIcon name={open ? "close" : "menu"} size={20} />
        </button>
      </header>

      {open ? (
        <div id="mobile-menu" className="fade-in fixed inset-x-0 bottom-0 top-14 z-30 overflow-y-auto bg-canvas px-4 pb-28 pt-4 md:hidden" role="dialog" aria-label="Navigation">
          <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
        </div>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/96 px-3 pt-1.5 backdrop-blur-xl md:hidden" aria-label="Primary navigation" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}>
        <div className="relative mx-auto grid max-w-md grid-cols-4 items-end">
          {primary.slice(0, 2).map((item) => {
            const active = isActive(path, item);
            return (
              <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? "text-blueprint" : "text-text-2"}`} aria-current={active ? "page" : undefined}>
                <TraceIcon name={item.glyph} size={20} />
                {item.label}
              </Link>
            );
          })}

          {!canCapture ? (
            <button type="button" disabled className="group relative flex min-h-14 flex-col items-center justify-end pb-0.5 text-[10px] font-semibold text-text-3 opacity-55" aria-label="Capture unavailable for read-only role" title="Student-authored capture is unavailable for this role">
              <span className="absolute -top-5 grid h-14 w-14 place-items-center rounded-[22px] border-4 border-surface bg-border-strong text-text-3">
                <TraceIcon name="capture" size={24} />
              </span>
              <span>{capture.label}</span>
            </button>
          ) : captureOnCanvas ? (
            <button
              type="button"
              className="group relative flex min-h-14 flex-col items-center justify-end pb-0.5 text-[10px] font-semibold text-blueprint"
              aria-label={capture.label}
              onClick={() => window.dispatchEvent(new CustomEvent("tracelab:capture"))}
            >
              <span className="absolute -top-5 grid h-14 w-14 place-items-center rounded-[22px] border-4 border-surface bg-blueprint text-white shadow-[0_10px_24px_rgb(65_105_255_/_0.28)] transition-transform duration-150 group-active:scale-95">
                <TraceIcon name="capture" size={24} />
              </span>
              <span>{capture.label}</span>
            </button>
          ) : (
            <Link href={capture.href} className="group relative flex min-h-14 flex-col items-center justify-end pb-0.5 text-[10px] font-semibold text-blueprint" aria-label={capture.label}>
              <span className="absolute -top-5 grid h-14 w-14 place-items-center rounded-[22px] border-4 border-surface bg-blueprint text-white shadow-[0_10px_24px_rgb(65_105_255_/_0.28)] transition-transform duration-150 group-active:scale-95">
                <TraceIcon name="capture" size={24} />
              </span>
              <span>{capture.label}</span>
            </Link>
          )}

          {primary.slice(2, 3).map((item) => {
            const active = isActive(path, item);
            return (
              <Link key={item.href} href={item.href} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-semibold ${active ? "text-blueprint" : "text-text-2"}`} aria-current={active ? "page" : undefined}>
                <TraceIcon name={item.glyph} size={20} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
