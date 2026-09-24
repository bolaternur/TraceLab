"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NavGroup, NavItem } from "@/components/nav";
import { TraceIcon } from "@/components/tracelab/trace-icon";

interface CommandPaletteProps {
  groups: NavGroup[];
  today: NavItem;
  capture: NavItem;
  compact?: boolean;
}

interface CommandItem {
  href: string;
  label: string;
  hint: string;
  glyph: string;
  keywords: string;
}

export function CommandPalette({ groups, today, capture, compact = false }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  const items = useMemo<CommandItem[]>(() => {
    const navItems = [today, capture, ...groups.flatMap((group) => group.items)];
    const deduped = new Map<string, CommandItem>();
    for (const item of navItems) {
      deduped.set(item.href, {
        href: item.href,
        label: item.label,
        hint: item.href,
        glyph: item.glyph,
        keywords: `${item.label} ${item.href}`.toLowerCase(),
      });
    }
    deduped.set("/app/search", {
      href: "/app/search",
      label: "Search project",
      hint: "IDs, filenames, decisions, tests",
      glyph: "search",
      keywords: "search project id filename evidence",
    });
    deduped.set("/app/inbox", {
      href: "/app/inbox?status=inbox",
      label: "Find missing rationale",
      hint: "Evidence that still needs human context",
      glyph: "evidence",
      keywords: "find missing rationale why context inbox",
    });
    return [...deduped.values()];
  }, [capture, groups, today]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items.slice(0, 9);
    return items.filter((item) => item.keywords.includes(needle) || item.hint.toLowerCase().includes(needle)).slice(0, 10);
  }, [items, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) closePalette();
        else setOpen(true);
      }
      if (event.key === "Escape") closePalette();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closePalette, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={compact ? "workbench-rail-action" : "trace-command-trigger hidden w-full items-center justify-between gap-3 rounded-xl border border-border bg-canvas px-3 py-2 text-left text-xs text-text-2 transition hover:border-border-strong hover:text-ink md:flex"}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={compact ? "Search / command" : undefined}
        title={compact ? "Search / command · Ctrl/⌘ K" : undefined}
        onClick={() => setOpen(true)}
      >
        {compact ? (
          <TraceIcon name="search" size={19} />
        ) : (
          <>
            <span className="flex items-center gap-2"><TraceIcon name="search" size={15} /> Search / command</span>
            <kbd className="mono rounded-md border border-border bg-surface px-1.5 py-0.5 text-[9px] text-text-3">⌘ K</kbd>
          </>
        )}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] grid place-items-start bg-ink/35 px-3 pt-[10vh] backdrop-blur-[2px] md:pt-[14vh]" role="presentation" onMouseDown={closePalette}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            className="w-full max-w-2xl overflow-hidden rounded-[22px] border border-border-strong bg-surface shadow-[0_24px_80px_rgb(17_19_21_/_0.24)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <TraceIcon name="search" size={18} className="text-text-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search project, open evidence, capture…"
                className="min-h-11 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-text-3 focus-visible:ring-2 focus-visible:ring-blueprint/45"
                aria-label="Search commands"
              />
              <kbd className="mono rounded-md border border-border bg-canvas px-2 py-1 text-[9px] text-text-3">ESC</kbd>
            </div>

            <div className="max-h-[56vh] overflow-y-auto p-2">
              <div className="trace-meta px-2 pb-1 pt-1 text-[9px] uppercase text-text-3">Navigate</div>
              {visible.length ? (
                <ul className="space-y-1">
                  {visible.map((item) => (
                    <li key={`${item.href}-${item.label}`}>
                      <Link
                        href={item.href}
                        onClick={closePalette}
                        className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-canvas focus-visible:bg-canvas"
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-canvas text-text-2">
                          <TraceIcon name={item.glyph} size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-ink">{item.label}</span>
                          <span className="block truncate text-[11px] text-text-3">{item.hint}</span>
                        </span>
                        <span className="mono text-[10px] text-text-3">↵</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-3">No matching command.</div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-canvas px-4 py-2.5 text-[10px] text-text-3">
              <span>Keyboard-first navigation · evidence stays primary</span>
              <span className="mono">CTRL/⌘ K</span>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
