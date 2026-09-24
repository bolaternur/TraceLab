"use client";

import { useState } from "react";
import { TraceCanvas } from "@/components/evidence-trace/trace-canvas";
import { TraceInspector } from "@/components/evidence-trace/trace-inspector";
import { TraceList } from "@/components/evidence-trace/trace-list";
import { TraceMobile } from "@/components/evidence-trace/trace-mobile";
import type { EvidenceTraceSnapshot } from "@/components/evidence-trace/types";

export function GraphView({ snapshot, initialSelectedId }: { snapshot: EvidenceTraceSnapshot; initialSelectedId: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  return (
    <div className="space-y-4">
      <div className="hidden h-[min(68vh,760px)] min-h-[520px] overflow-hidden rounded-[20px] border border-black/8 bg-[#202124] shadow-[0_14px_44px_rgba(17,19,21,.12)] md:grid md:grid-cols-[minmax(0,1fr)_340px]">
        <TraceCanvas snapshot={snapshot} selectedId={selectedId} initialFocusId={initialSelectedId} onSelect={setSelectedId} />
        <TraceInspector snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} onClose={() => setSelectedId(null)} />
      </div>
      <TraceMobile snapshot={snapshot} initialSelectedId={initialSelectedId} />
      <TraceList snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} />
    </div>
  );
}
