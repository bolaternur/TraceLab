"use client";

import { create } from "zustand";
import type { WorkbenchNodeModel } from "./types";
import {
  initialWorkbenchCanvasState,
  reduceWorkbenchCanvasState,
  type WorkbenchCanvasAction,
  type WorkbenchCanvasStateModel,
  type WorkbenchViewport,
} from "./state";
import { getLayoutStorageKey } from "./layout";

export interface StoredBoardPosition {
  x: number;
  y: number;
}

interface WorkbenchStore extends WorkbenchCanvasStateModel {
  boardPositions: Record<string, StoredBoardPosition>;
  dispatch: (action: WorkbenchCanvasAction) => void;
  setBoardPosition: (id: string, position: StoredBoardPosition) => void;
  hydrateBoardPositions: (teamId: string, seasonId: string | null, nodes: readonly WorkbenchNodeModel[]) => void;
  persistBoardPositions: (teamId: string, seasonId: string | null) => void;
  resetBoardPositions: (teamId: string, seasonId: string | null) => void;
  focusBoard: (id: string, viewport: WorkbenchViewport) => void;
}

function parseStoredPositions(value: string | null): Record<string, StoredBoardPosition> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, StoredBoardPosition>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, position]) => Number.isFinite(position?.x) && Number.isFinite(position?.y)),
    );
  } catch {
    return {};
  }
}

export const useWorkbenchStore = create<WorkbenchStore>((set, get) => ({
  ...initialWorkbenchCanvasState,
  boardPositions: {},
  dispatch: (action) => set((state) => reduceWorkbenchCanvasState(state, action)),
  focusBoard: (id, viewport) => set((state) => reduceWorkbenchCanvasState(state, { type: "focus", id, viewport })),
  setBoardPosition: (id, position) =>
    set((state) => ({ boardPositions: { ...state.boardPositions, [id]: position } })),
  hydrateBoardPositions: (teamId, seasonId, nodes) => {
    if (typeof window === "undefined") return;
    const key = getLayoutStorageKey(teamId, seasonId);
    const stored = parseStoredPositions(window.localStorage.getItem(key));
    const defaults = Object.fromEntries(nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
    set({ boardPositions: { ...defaults, ...stored } });
  },
  persistBoardPositions: (teamId, seasonId) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getLayoutStorageKey(teamId, seasonId), JSON.stringify(get().boardPositions));
  },
  resetBoardPositions: (teamId, seasonId) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(getLayoutStorageKey(teamId, seasonId));
    set({ boardPositions: {} });
  },
}));
