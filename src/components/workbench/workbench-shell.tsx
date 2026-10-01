"use client";

// locale-wired
import { UiElement, UiText } from "@/components/locale-provider";
import Link from "next/link";
import * as ResizablePrimitive from "react-resizable-panels";
import { useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { captureDestination, type CaptureWorkspaceOptions } from "@/components/capture/model";
import type { CaptureSavedResult } from "@/components/capture/use-capture-controller";
import { initialCaptureOverlayState, reduceCaptureOverlayState } from "@/components/capture/state";
import { InspectorHost } from "./inspector-host";
import { MobileWorkbench } from "./mobile-workbench";
import { SpatialCanvas } from "./spatial-canvas";
import { useWorkbenchStore } from "./store";
import { WorkbenchTopBar } from "./workbench-top-bar";
import { CaptureLauncher } from "./capture-launcher";
import type { WorkbenchSnapshot } from "./types";
import { getWorkboardPresentation, WorkboardContent } from "./workboard-content";

const OVERVIEW_BOARDS = [
  { kind: "recent-evidence", href: "/app/inbox", color: "var(--robot-blue)" },
  { kind: "active-iteration", href: "/app/iterations", color: "var(--color-blueprint)" },
  { kind: "test-bench", href: "/app/tests", color: "var(--robot-yellow)" },
  { kind: "decision-trail", href: "/app/decisions", color: "var(--robot-pink)" },
  { kind: "needs-context", href: "/app/inbox", color: "var(--robot-green)" },
  { kind: "process-health", href: "/app/competition", color: "var(--robot-blue)" },
] as const;

export function WorkbenchShell({ snapshot, captureOptions }: { snapshot: WorkbenchSnapshot; captureOptions: CaptureWorkspaceOptions }) {
  const router = useRouter();
  const [spatial, setSpatial] = useState(false);
  const inspectorOpen = useWorkbenchStore((state) => state.inspectorOpen);
  const workbenchDispatch = useWorkbenchStore((state) => state.dispatch);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [captureState, captureDispatch] = useReducer(reduceCaptureOverlayState, initialCaptureOverlayState);

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  function handleCaptureSaved(result: CaptureSavedResult) {
    const destination = captureDestination(result.kind);
    captureDispatch({ type: "set-saving", saving: false });
    captureDispatch({ type: "close" });
    workbenchDispatch({ type: "mark-recent-update", id: destination });
    router.refresh();

    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => {
      workbenchDispatch({ type: "mark-recent-update", id: null });
      highlightTimer.current = null;
    }, 1200);
  }

  return (
    <UiElement as="section" className="workbench-surface h-full w-full" aria-label="Spatial Evidence Workbench">
      {!spatial ? <div className="robot-overview hidden h-full overflow-y-auto p-6 pb-24 md:block lg:p-10">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-3xl font-semibold text-ink"><UiText text="Workbench" /></h1><p className="mt-2 text-text-2"><UiText text="Your robot, one step at a time." /></p></div>
          <div className="flex gap-3"><button type="button" className="btn" onClick={() => setSpatial(true)}><UiText text="Canvas view" /></button><button type="button" className="btn btn-primary" disabled={!captureOptions.canAuthorStudentContent} onClick={() => captureDispatch({ type: "open" })}><UiText text="Capture evidence" /> +</button></div>
        </header>
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {OVERVIEW_BOARDS.map(({kind, href, color}) => {
            const presentation = getWorkboardPresentation(kind, snapshot);
            return <article key={kind} className="workbench-board flex min-h-64 flex-col p-5" style={{borderTopColor:color,borderTopWidth:3}}>
              <h2 className="mb-5 text-xl font-semibold text-ink"><UiText text={presentation.title} /></h2>
              <div className="flex-1"><WorkboardContent kind={kind} snapshot={snapshot} /></div>
              <Link href={href} className="mt-5 self-start text-sm font-semibold text-signal"><UiText text="Open" /> ↗</Link>
            </article>;
          })}
        </div>
      </div> : null}
      <div className={spatial ? "hidden h-full md:block" : "hidden"}>
        <button type="button" className="btn absolute bottom-5 right-5 z-50" onClick={() => setSpatial(false)}><UiText text="Overview" /></button>
        <ResizablePrimitive.Group orientation="horizontal" className="h-full w-full">
          <ResizablePrimitive.Panel id="workbench-canvas" defaultSize="100%" minSize="52%">
            <div className="relative h-full min-w-0 overflow-hidden">
              <SpatialCanvas snapshot={snapshot} />
              <WorkbenchTopBar snapshot={snapshot} canCapture={captureOptions.canAuthorStudentContent} onCapture={() => captureDispatch({ type: "open" })} />
            </div>
          </ResizablePrimitive.Panel>
          {inspectorOpen ? (
            <>
              <ResizablePrimitive.Separator className="workbench-inspector-separator" aria-label="Resize inspector" />
              <ResizablePrimitive.Panel id="workbench-inspector" defaultSize="390px" minSize="320px" maxSize="520px">
                <InspectorHost snapshot={snapshot} />
              </ResizablePrimitive.Panel>
            </>
          ) : null}
        </ResizablePrimitive.Group>
      </div>
      <MobileWorkbench snapshot={snapshot} />
      <CaptureLauncher state={captureState} dispatch={captureDispatch} options={captureOptions} onSaved={handleCaptureSaved} />
    </UiElement>
  );
}
