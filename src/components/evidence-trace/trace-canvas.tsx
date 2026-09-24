"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { isEditableSpatialTarget } from "@/components/spatial-motion/input";
import { motionDuration } from "@/components/spatial-motion/policy";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  SelectionMode,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
  type Viewport,
} from "@xyflow/react";
import { firstOrderNeighborhood, visualRelationEndpoints } from "./model";
import { layoutEvidenceTrace } from "./layout";
import { layoutEvidenceTraceWithElk } from "./elk-layout";
import { TraceRelationEdge, type EvidenceTraceFlowEdge } from "./trace-edge";
import { TraceNode, type EvidenceTraceFlowNode } from "./trace-node";
import { TraceControls } from "./trace-controls";
import type { EvidenceTraceLayout, EvidenceTraceSnapshot } from "./types";

const NODE_TYPES: NodeTypes = { traceNode: TraceNode };
const EDGE_TYPES: EdgeTypes = { traceRelation: TraceRelationEdge };


function TraceFlowInner({ snapshot, selectedId, initialFocusId, onSelect }: { snapshot: EvidenceTraceSnapshot; selectedId: string | null; initialFocusId: string | null; onSelect: (id: string | null) => void }) {
  const [layout, setLayout] = useState<EvidenceTraceLayout>(() => layoutEvidenceTrace(snapshot));
  const [helpOpen, setHelpOpen] = useState(false);
  const [layoutSettled, setLayoutSettled] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [handMode, setHandMode] = useState(false);
  const previousViewport = useRef<Viewport | null>(null);
  const initialFocusConsumed = useRef(false);
  const reduceMotion = useReducedMotion();
  const { fitView, getViewport, setViewport, zoomTo } = useReactFlow<EvidenceTraceFlowNode>();

  useEffect(() => {
    let cancelled = false;
    let frame = 0;
    const resetFrame = window.requestAnimationFrame(() => {
      setLayout(layoutEvidenceTrace(snapshot));
      setLayoutSettled(false);
    });
    initialFocusConsumed.current = false;
    void layoutEvidenceTraceWithElk(snapshot).then((next) => {
      if (cancelled) return;
      setLayout(next);
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          if (cancelled) return;
          if (!initialFocusId) void fitView({ padding: 0.16, duration: motionDuration("standard", Boolean(reduceMotion)), minZoom: 0.4, maxZoom: 0.92 });
          setLayoutSettled(true);
        });
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(resetFrame);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [fitView, initialFocusId, reduceMotion, snapshot]);

  const neighborhood = useMemo(() => firstOrderNeighborhood(snapshot, selectedId), [selectedId, snapshot]);
  const nodes = useMemo<EvidenceTraceFlowNode[]>(() => layout.nodes.map((node) => ({
    id: node.id,
    type: "traceNode",
    position: { x: node.x, y: node.y },
    style: { width: node.width, height: node.height },
    selected: selectedId === node.id,
    selectable: true,
    draggable: false,
    data: { node, dimmed: Boolean(selectedId && !neighborhood.has(node.id)) },
  })), [layout.nodes, neighborhood, selectedId]);
  const edges = useMemo<EvidenceTraceFlowEdge[]>(() => layout.relations.map((relation) => {
    const active = selectedId === relation.fromId || selectedId === relation.toId;
    const dimmed = Boolean(selectedId && !active);
    const endpoints = visualRelationEndpoints(snapshot, relation);
    return {
      id: relation.id,
      source: endpoints.source,
      target: endpoints.target,
      type: "traceRelation",
      animated: false,
      selectable: false,
      focusable: false,
      data: { relation, active, dimmed },
    };
  }), [layout.relations, selectedId, snapshot]);

  const focusNode = useCallback((id: string) => {
    const node = nodes.find((candidate) => candidate.id === id);
    if (!node) return;
    previousViewport.current = getViewport();
    void fitView({ nodes: [node], padding: 0.55, duration: motionDuration("camera", Boolean(reduceMotion)), maxZoom: 1.12 });
  }, [fitView, getViewport, nodes, reduceMotion]);

  useEffect(() => {
    if (!initialFocusId || !layoutSettled || initialFocusConsumed.current) return;
    if (!nodes.some((node) => node.id === initialFocusId)) return;
    let frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(() => {
        focusNode(initialFocusId);
        initialFocusConsumed.current = true;
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusNode, initialFocusId, layoutSettled, nodes]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (isEditableSpatialTarget(event.target)) return;
      if (event.code === "Space" && !event.repeat) setHandMode(true);
      if (event.key === "?" && !event.ctrlKey && !event.metaKey) { event.preventDefault(); setHelpOpen(true); }
      if (event.key === "f" || event.key === "F" || event.key === "0") { event.preventDefault(); void fitView({ padding: 0.16, duration: motionDuration("standard", Boolean(reduceMotion)) }); }
      if (event.key === "1") { event.preventDefault(); void zoomTo(1, { duration: motionDuration("standard", Boolean(reduceMotion)) }); }
      if (event.key === "Enter" && selectedId) { event.preventDefault(); focusNode(selectedId); }
      if (event.key === "Escape") {
        if (previousViewport.current) {
          void setViewport(previousViewport.current, { duration: motionDuration("standard", Boolean(reduceMotion)) });
          previousViewport.current = null;
        } else if (selectedId) onSelect(null);
        setHelpOpen(false);
      }
    };
    const keyup = (event: KeyboardEvent) => { if (event.code === "Space") setHandMode(false); };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  }, [fitView, focusNode, onSelect, reduceMotion, selectedId, setViewport, zoomTo]);

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-[#202124]" data-interaction-mode={handMode ? "hand" : "select"}>
      <ReactFlow<EvidenceTraceFlowNode, EvidenceTraceFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
        panActivationKeyCode="Space"
        zoomActivationKeyCode={["Meta", "Control"]}
        zoomOnDoubleClick={false}
        selectNodesOnDrag={false}
        deleteKeyCode={null}
        minZoom={0.28}
        maxZoom={1.7}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.16, minZoom: 0.4, maxZoom: 0.92 }}
        onNodeClick={(_, node) => onSelect(node.id)}
        onNodeDoubleClick={(_, node) => { onSelect(node.id); focusNode(node.id); }}
        onPaneClick={() => onSelect(null)}
        onMoveStart={(event) => {
          if (event) void setViewport(getViewport(), { duration: 0 });
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,.095)" />
        {minimapOpen ? <MiniMap pannable zoomable className="trace-minimap" maskColor="rgba(25,26,28,.66)" nodeColor="rgba(251,251,248,.88)" /> : null}
        <TraceControls onHelp={() => setHelpOpen(true)} />
        <button type="button" className="trace-minimap-toggle" onClick={() => setMinimapOpen((open) => !open)} aria-label={minimapOpen ? "Hide evidence trace minimap" : "Show evidence trace minimap"}><span className="mono text-[9px]">MAP</span></button>
      </ReactFlow>

      <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-[#242527]/92 px-3 py-2 text-[10px] text-white/54 shadow-lg backdrop-blur-[2px]">
        <strong className="block text-[11px] font-semibold text-white/80">Evidence Trace</strong>
        <span className="mono">{snapshot.nodes.length} objects · {snapshot.relations.length} relations</span>
      </div>

      {helpOpen ? (
        <div className="trace-shortcut-help" role="dialog" aria-label="Evidence Trace keyboard shortcuts">
          <div className="flex items-center justify-between gap-4"><strong className="text-sm">Trace shortcuts</strong><button type="button" onClick={() => setHelpOpen(false)} aria-label="Close Evidence Trace keyboard shortcuts">×</button></div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs text-white/62">
            <dt className="mono text-white">Space</dt><dd>Pan</dd>
            <dt className="mono text-white">F / 0</dt><dd>Fit trace</dd>
            <dt className="mono text-white">1</dt><dd>100% zoom</dd>
            <dt className="mono text-white">Enter</dt><dd>Focus selected evidence</dd>
            <dt className="mono text-white">Esc</dt><dd>Return / clear focus</dd>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function TraceCanvas(props: { snapshot: EvidenceTraceSnapshot; selectedId: string | null; initialFocusId: string | null; onSelect: (id: string | null) => void }) {
  return <ReactFlowProvider><TraceFlowInner {...props} /></ReactFlowProvider>;
}
