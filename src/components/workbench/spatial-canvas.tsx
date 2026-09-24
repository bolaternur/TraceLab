"use client";

import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  useEdgesState,
  useNodesState,
  useReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import { buildWorkbenchEdges, buildWorkbenchNodes, getWorkbenchExtent } from "./layout";
import { CanvasControls } from "./canvas-controls";
import { WorkboardNode, type WorkbenchFlowNode } from "./workboard-node";
import { WorkbenchSnapshotProvider } from "./workbench-context";
import { TraceEdge, type WorkbenchTraceEdge } from "./trace-edge";
import { useWorkbenchStore } from "./store";
import type { WorkbenchSnapshot } from "./types";

const NODE_TYPES: NodeTypes = { workboard: WorkboardNode };
const EDGE_TYPES: EdgeTypes = { trace: TraceEdge };
const MULTI_SELECT_KEY = ["Meta", "Shift"];


function SpatialCanvasInner({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  const models = useMemo(() => buildWorkbenchNodes(snapshot), [snapshot]);
  const edgeModels = useMemo(() => buildWorkbenchEdges(snapshot), [snapshot]);
  const extent = useMemo(() => getWorkbenchExtent(models), [models]);
  const initialNodes = useMemo<WorkbenchFlowNode[]>(
    () => models.map((model) => ({
      id: model.id,
      type: "workboard",
      position: { x: model.x, y: model.y },
      style: { width: model.width, height: model.height },
      data: { kind: model.kind },
    })),
    [models],
  );
  const initialEdges = useMemo<WorkbenchTraceEdge[]>(
    () => edgeModels.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "trace",
      selectable: false,
      focusable: false,
      animated: false,
      data: { relation: edge.relation },
    })),
    [edgeModels],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkbenchFlowNode>(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const [helpOpen, setHelpOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const { fitView, getViewport, setViewport, zoomTo } = useReactFlow<WorkbenchFlowNode, WorkbenchTraceEdge>();
  const selectedId = useWorkbenchStore((state) => state.selectedId);
  const minimapOpen = useWorkbenchStore((state) => state.minimapOpen);
  const interactionMode = useWorkbenchStore((state) => state.interactionMode);
  const dispatch = useWorkbenchStore((state) => state.dispatch);
  const hydrateBoardPositions = useWorkbenchStore((state) => state.hydrateBoardPositions);
  const setBoardPosition = useWorkbenchStore((state) => state.setBoardPosition);
  const persistBoardPositions = useWorkbenchStore((state) => state.persistBoardPositions);
  const resetBoardPositions = useWorkbenchStore((state) => state.resetBoardPositions);
  const focusBoard = useWorkbenchStore((state) => state.focusBoard);

  useEffect(() => {
    hydrateBoardPositions(snapshot.team.id, snapshot.project.seasonId, models);
    const stored = useWorkbenchStore.getState().boardPositions;
    setNodes((current) => current.map((node) => ({ ...node, position: stored[node.id] ?? node.position })));
  }, [hydrateBoardPositions, models, setNodes, snapshot.project.seasonId, snapshot.team.id]);

  useEffect(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: node.id === selectedId })));
  }, [selectedId, setNodes]);

  const resetLayout = useCallback(() => {
    resetBoardPositions(snapshot.team.id, snapshot.project.seasonId);
    setNodes(initialNodes);
    void fitView({ padding: 0.18, duration: motionDuration("camera", Boolean(reduceMotion)), maxZoom: 0.82 });
  }, [fitView, initialNodes, reduceMotion, resetBoardPositions, setNodes, snapshot.project.seasonId, snapshot.team.id]);

  const focusNode = useCallback((node: WorkbenchFlowNode) => {
    focusBoard(node.id, getViewport());
    void fitView({ nodes: [node], padding: 0.24, duration: motionDuration("camera", Boolean(reduceMotion)), maxZoom: 1.08 });
  }, [fitView, focusBoard, getViewport, reduceMotion]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableSpatialTarget(event.target)) return;
      if (event.code === "Space" && !event.repeat) dispatch({ type: "set-interaction-mode", mode: "hand" });
      if (event.key === "?" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setHelpOpen(true);
      }
      if (event.key === "f" || event.key === "F" || event.key === "0") {
        event.preventDefault();
        void fitView({ padding: 0.14, duration: motionDuration("standard", Boolean(reduceMotion)) });
      }
      if (event.key === "1") {
        event.preventDefault();
        void zoomTo(1, { duration: motionDuration("standard", Boolean(reduceMotion)) });
      }
      if (event.key === "Enter") {
        const selected = nodes.find((node) => node.id === useWorkbenchStore.getState().selectedId);
        if (selected) {
          event.preventDefault();
          focusNode(selected);
        }
      }
      if (event.key === "Escape") {
        const state = useWorkbenchStore.getState();
        if (state.focusedId && state.lastViewport) void setViewport(state.lastViewport, { duration: motionDuration("camera", Boolean(reduceMotion)) });
        dispatch({ type: "escape" });
        setHelpOpen(false);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") dispatch({ type: "set-interaction-mode", mode: "select" });
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [dispatch, fitView, focusNode, nodes, reduceMotion, setViewport, zoomTo]);

  return (
    <div className="h-full w-full" data-interaction-mode={interactionMode}>
      <ReactFlow<WorkbenchFlowNode, WorkbenchTraceEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={(_, node) => dispatch({ type: "select", id: node.id })}
        onNodeDoubleClick={(_, node) => focusNode(node)}
        onPaneClick={() => dispatch({ type: "select", id: null })}
        onMoveStart={(event) => {
          if (event) void setViewport(getViewport(), { duration: 0 });
        }}
        onNodeDragStop={(_, node) => {
          setBoardPosition(node.id, node.position);
          persistBoardPositions(snapshot.team.id, snapshot.project.seasonId);
        }}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        panOnDrag={[1, 2]}
        panOnScroll
        panActivationKeyCode="Space"
        zoomActivationKeyCode={["Meta", "Control"]}
        multiSelectionKeyCode={MULTI_SELECT_KEY}
        selectNodesOnDrag={false}
        zoomOnDoubleClick={false}
        minZoom={0.35}
        maxZoom={1.65}
        translateExtent={extent}
        nodeExtent={extent}
        onlyRenderVisibleElements
        fitView
        fitViewOptions={{ padding: 0.18, minZoom: 0.42, maxZoom: 0.82 }}
        deleteKeyCode={null}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="rgba(255,255,255,.10)" />
        {minimapOpen ? (
          <MiniMap
            pannable
            zoomable
            className="workbench-minimap"
            maskColor="rgba(25,26,28,.62)"
            nodeColor="rgba(251,251,248,.88)"
          />
        ) : null}
        <CanvasControls onResetLayout={resetLayout} onShowHelp={() => setHelpOpen(true)} />
      </ReactFlow>

      {helpOpen ? (
        <div className="workbench-shortcut-help workbench-chrome" role="dialog" aria-modal="false" aria-label="Canvas keyboard shortcuts">
          <div className="flex items-center justify-between gap-4">
            <strong className="text-sm">Canvas shortcuts</strong>
            <button type="button" onClick={() => setHelpOpen(false)} aria-label="Close keyboard shortcuts">×</button>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs text-white/68">
            <dt className="mono text-white">Space</dt><dd>Pan</dd>
            <dt className="mono text-white">F / 0</dt><dd>Fit project</dd>
            <dt className="mono text-white">1</dt><dd>100% zoom</dd>
            <dt className="mono text-white">Enter</dt><dd>Focus selected board</dd>
            <dt className="mono text-white">Esc</dt><dd>Back one spatial layer</dd>
            <dt className="mono text-white">⌘/Ctrl K</dt><dd>Command palette</dd>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function SpatialCanvas({ snapshot }: { snapshot: WorkbenchSnapshot }) {
  return (
    <WorkbenchSnapshotProvider snapshot={snapshot}>
      <ReactFlowProvider>
        <SpatialCanvasInner snapshot={snapshot} />
      </ReactFlowProvider>
    </WorkbenchSnapshotProvider>
  );
}
