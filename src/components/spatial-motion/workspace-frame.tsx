"use client";
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { UiText } from "@/components/locale-provider";

export function WorkspaceFrame({ title, href, linkLabel, controls, children }: { title: string; href: string; linkLabel: string; controls: ReactNode; children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  return <section className="canvas-workspace" data-tools-visible={visible}>
    <div className="canvas-toolbar">
      <button type="button" className="btn" aria-expanded={visible} aria-controls="canvas-tools" onClick={() => setVisible(!visible)}><UiText text={visible ? "Hide tools" : "Show tools"} /></button>
      {visible && <div id="canvas-tools" className="canvas-tools">
        <h1 className="text-base font-medium"><UiText text={title} /></h1>
        <Link href={href} className="btn"><UiText text={linkLabel} /></Link>
        <details className="canvas-filter-menu"><summary className="btn"><UiText text="Filters" /></summary><div className="canvas-filter-content">{controls}</div></details>
      </div>}
    </div>
    {children}
  </section>;
}
