"use client";

// locale-wired
import { UiText, UiElement, useUiText } from "@/components/locale-provider";
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


function TraceFlowInner({ snapshot, selectedId, initialFocusId, onSelect, storageKey }: { snapshot: EvidenceTraceSnapshot; selectedId: string | null; initialFocusId: string | null; onSelect: (id: string | null) => void; storageKey: string }) {
  const [layout, setLayout] = useState<EvidenceTraceLayout>(() => layoutEvidenceTrace(snapshot));
  const [helpOpen, setHelpOpen] = useState(false);
  const [layoutSettled, setLayoutSettled] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [handMode, setHandMode] = useState(false);
  const [query, setQuery] = useState("");
  const t = useUiText();
  const matches = useMemo(() => query.trim() ? snapshot.nodes.filter(node => node.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0, 8) : [], [query, snapshot.nodes]);
  const positions = useRef<Record<string, { x: number; y: number }>>({});
  const mergePositions = useCallback((value: EvidenceTraceLayout): EvidenceTraceLayout => ({
    ...value, nodes: value.nodes.map(node => ({ ...node, ...(positions.current[node.id] ?? {}) })),
  }), []);
  const previousViewport = useRef<Viewport | null>(null);
  const initialFocusConsumed = useRef(false);
  const reduceMotion = useReducedMotion();
  const { fitView, getViewport, setViewport, zoomTo } = useReactFlow<EvidenceTraceFlowNode>();

  useEffect(() => {
    positions.current = {};
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      for (const node of snapshot.nodes) {
        const value = saved?.[node.id];
        if (Number.isFinite(value?.x) && Number.isFinite(value?.y)) positions.current[node.id] = { x: value.x, y: value.y };
      }
    } catch { /* Storage can be unavailable; dragging remains available. */ }
    let cancelled = false;
    let frame = 0;
    const resetFrame = window.requestAnimationFrame(() => {
      setLayout(mergePositions(layoutEvidenceTrace(snapshot)));
      setLayoutSettled(false);
    });
    initialFocusConsumed.current = false;
    void layoutEvidenceTraceWithElk(snapshot).then((next) => {
      if (cancelled) return;
      setLayout(mergePositions(next));
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
  }, [fitView, initialFocusId, reduceMotion, snapshot, storageKey, mergePositions]);

  const neighborhood = useMemo(() => firstOrderNeighborhood(snapshot, selectedId), [selectedId, snapshot]);
  const nodes = useMemo<EvidenceTraceFlowNode[]>(() => layout.nodes.map((node) => ({
    id: node.id,
    type: "traceNode",
    position: { x: node.x, y: node.y },
    style: { width: node.width, height: node.height },
    selected: selectedId === node.id,
    selectable: true,
    draggable: true,
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
    <div className="relative h-full min-h-0 w-full overflow-hidden bg-canvas" data-interaction-mode={handMode ? "hand" : "select"}>
      <div className="trace-node-search">
        <label className="flex items-center gap-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label={t("Find a record")} placeholder={t("Find a record")} /></label>
        {query.trim() && <div className="trace-search-results">{matches.length ? matches.map(node => <button key={node.id} type="button" onClick={() => { onSelect(node.id); focusNode(node.id); setQuery(""); }}>{node.label}</button>) : <p><UiText text="No matching records" /></p>}</div>}
      </div>
      <ReactFlow<EvidenceTraceFlowNode, EvidenceTraceFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        nodesDraggable
        onNodesChange={(changes) => {
          const moves = changes.filter(change => change.type === "position" && change.position);
          if (!moves.length) return;
          setLayout(current => ({ ...current, nodes: current.nodes.map(node => {
            const move = moves.find(change => change.type === "position" && change.id === node.id);
            if (!move || move.type !== "position" || !move.position) return node;
            positions.current[node.id] = move.position;
            return { ...node, x: move.position.x, y: move.position.y };
          }) }));
        }}
        onNodeDragStop={() => { try { localStorage.setItem(storageKey, JSON.stringify(positions.current)); } catch { /* Session layout still works. */ } }}
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
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d4d8ce" />
        {minimapOpen ? <MiniMap pannable zoomable className="trace-minimap" maskColor="rgba(244,241,233,.6)" nodeColor="#b74722" /> : null}
        <TraceControls onHelp={() => setHelpOpen(true)} />
        <UiElement as="button" type="button" className="trace-minimap-toggle" onClick={() => setMinimapOpen((open) => !open)} aria-label={minimapOpen ? "Hide evidence trace minimap" : "Show evidence trace minimap"}><span className="mono text-[9px]"><UiText text="MAP" /></span></UiElement>
      </ReactFlow>

      {helpOpen ? (
        <UiElement as="div" className="trace-shortcut-help" role="dialog" aria-label="Evidence Trace keyboard shortcuts">
          <div className="flex items-center justify-between gap-4"><strong className="text-sm"><UiText text="Trace shortcuts" /></strong><UiElement as="button" type="button" onClick={() => setHelpOpen(false)} aria-label="Close Evidence Trace keyboard shortcuts">×</UiElement></div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs text-white/62">
            <dt className="mono text-white"><UiText text="Space" /></dt><dd><UiText text="Pan" /></dd>
            <dt className="mono text-white">F / 0</dt><dd><UiText text="Fit trace" /></dd>
            <dt className="mono text-white">1</dt><dd><UiText text="100% zoom" /></dd>
            <dt className="mono text-white"><UiText text="Enter" /></dt><dd><UiText text="Focus selected evidence" /></dd>
            <dt className="mono text-white"><UiText text="Esc" /></dt><dd><UiText text="Return / clear focus" /></dd>
          </dl>
        </UiElement>
      ) : null}
    </div>
  );
}

export function TraceCanvas(props: { snapshot: EvidenceTraceSnapshot; selectedId: string | null; initialFocusId: string | null; onSelect: (id: string | null) => void; storageKey: string }) {
  return <ReactFlowProvider><TraceFlowInner {...props} /></ReactFlowProvider>;
}
