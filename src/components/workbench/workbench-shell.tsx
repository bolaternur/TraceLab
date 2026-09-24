"use client";

import * as ResizablePrimitive from "react-resizable-panels";
import { useEffect, useReducer, useRef } from "react";
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

export function WorkbenchShell({ snapshot, captureOptions }: { snapshot: WorkbenchSnapshot; captureOptions: CaptureWorkspaceOptions }) {
  const router = useRouter();
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
    <section className="workbench-surface h-full w-full" aria-label="Spatial Evidence Workbench">
      <div className="hidden h-full md:block">
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
    </section>
  );
}
