import type { WorkboardKind } from "./types";

export interface WorkbenchViewport {
  x: number;
  y: number;
  zoom: number;
}

export type WorkbenchInteractionMode = "select" | "hand";

export interface WorkbenchCanvasStateModel {
  selectedId: string | null;
  focusedId: string | null;
  inspectorOpen: boolean;
  inspectorWidth: number;
  minimapOpen: boolean;
  interactionMode: WorkbenchInteractionMode;
  lastViewport: WorkbenchViewport | null;
  restoreViewport: WorkbenchViewport | null;
  recentlyUpdatedBoard: WorkboardKind | null;
}

export const initialWorkbenchCanvasState: WorkbenchCanvasStateModel = {
  selectedId: null,
  focusedId: null,
  inspectorOpen: false,
  inspectorWidth: 380,
  minimapOpen: true,
  interactionMode: "select",
  lastViewport: null,
  restoreViewport: null,
  recentlyUpdatedBoard: null,
};

export type WorkbenchCanvasAction =
  | { type: "select"; id: string | null }
  | { type: "focus"; id: string; viewport: WorkbenchViewport }
  | { type: "escape" }
  | { type: "set-inspector-open"; open: boolean }
  | { type: "set-inspector-width"; width: number }
  | { type: "set-minimap-open"; open: boolean }
  | { type: "set-interaction-mode"; mode: WorkbenchInteractionMode }
  | { type: "clear-restore-viewport" }
  | { type: "mark-recent-update"; id: WorkboardKind | null };

export function reduceWorkbenchCanvasState(
  state: WorkbenchCanvasStateModel,
  action: WorkbenchCanvasAction,
): WorkbenchCanvasStateModel {
  switch (action.type) {
    case "select":
      return {
        ...state,
        selectedId: action.id,
        focusedId: action.id ? state.focusedId : null,
        inspectorOpen: Boolean(action.id),
        restoreViewport: null,
      };
    case "focus":
      return {
        ...state,
        selectedId: action.id,
        focusedId: action.id,
        inspectorOpen: true,
        lastViewport: action.viewport,
        restoreViewport: null,
      };
    case "escape":
      if (state.focusedId) {
        return {
          ...state,
          focusedId: null,
          restoreViewport: state.lastViewport,
          lastViewport: null,
        };
      }
      if (state.selectedId || state.inspectorOpen) {
        return {
          ...state,
          selectedId: null,
          inspectorOpen: false,
          restoreViewport: null,
        };
      }
      return state;
    case "set-inspector-open":
      return {
        ...state,
        inspectorOpen: action.open,
        selectedId: action.open ? state.selectedId : null,
      };
    case "set-inspector-width":
      return { ...state, inspectorWidth: Math.min(520, Math.max(320, action.width)) };
    case "set-minimap-open":
      return { ...state, minimapOpen: action.open };
    case "set-interaction-mode":
      return { ...state, interactionMode: action.mode };
    case "clear-restore-viewport":
      return { ...state, restoreViewport: null };
    case "mark-recent-update":
      return { ...state, recentlyUpdatedBoard: action.id };
  }
}
