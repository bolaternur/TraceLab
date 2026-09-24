"use client";

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
    <div className="space-y-4">
      <div className="hidden min-h-[560px] overflow-hidden rounded-[20px] border border-black/8 bg-[#202124] shadow-[0_14px_44px_rgba(17,19,21,.12)] md:grid md:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <TimelineSurface
            snapshot={snapshot}
            initialScale={initialScale}
            selectedId={selectedId}
            initialFocusId={initialSelectedId}
            onSelect={setSelectedId}
          />
        </div>
        <TimelineInspector snapshot={snapshot} selectedId={selectedId} onClose={() => setSelectedId(null)} />
      </div>
      <TimelineMobile snapshot={snapshot} initialSelectedId={initialSelectedId} />
      <TimelineList snapshot={snapshot} />
    </div>
  );
}
