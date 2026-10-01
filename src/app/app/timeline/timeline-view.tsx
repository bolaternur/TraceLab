"use client";

import { UiText } from "@/components/locale-provider";
import { useState } from "react";
import { TimelineInspector } from "@/components/engineering-timeline/timeline-inspector";
import { TimelineList } from "@/components/engineering-timeline/timeline-list";
import { TimelineMobile } from "@/components/engineering-timeline/timeline-mobile";
import { TimelineSurface } from "@/components/engineering-timeline/timeline-surface";
import type { EngineeringTimelineSnapshot, TimelineScale } from "@/components/engineering-timeline/types";

export function TimelineView({
  snapshot,
  initialScale,
  initialSelectedId,
}: {
  snapshot: EngineeringTimelineSnapshot;
  initialScale: TimelineScale;
  initialSelectedId: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  return (
    <div className="canvas-view">
      <div className="canvas-timeline-stage">
        <div className="min-w-0">
          <TimelineSurface
            snapshot={snapshot}
            initialScale={initialScale}
            selectedId={selectedId}
            initialFocusId={initialSelectedId}
            onSelect={setSelectedId}
          />
        </div>
        {selectedId && <div className="canvas-inspector"><TimelineInspector snapshot={snapshot} selectedId={selectedId} onClose={() => setSelectedId(null)} /></div>}
      </div>
      <TimelineMobile snapshot={snapshot} initialSelectedId={initialSelectedId} />
      <details className="canvas-record-list canvas-timeline-list"><summary className="btn"><UiText text="List view" /></summary><div><TimelineList snapshot={snapshot} /></div></details>
    </div>
  );
}
