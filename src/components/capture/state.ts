import type { CaptureKind } from "./model.ts";

export type CaptureOverlayStage = "choose" | "compose";

export interface CaptureOverlayState {
  open: boolean;
  stage: CaptureOverlayStage;
  kind: CaptureKind | null;
  saving: boolean;
}

export const initialCaptureOverlayState: CaptureOverlayState = {
  open: false,
  stage: "choose",
  kind: null,
  saving: false,
};

export type CaptureOverlayAction =
  | { type: "open" }
  | { type: "open-kind"; kind: CaptureKind }
  | { type: "select-kind"; kind: CaptureKind }
  | { type: "back" }
  | { type: "set-saving"; saving: boolean }
  | { type: "close" };

export function reduceCaptureOverlayState(state: CaptureOverlayState, action: CaptureOverlayAction): CaptureOverlayState {
  switch (action.type) {
    case "open":
      return { open: true, stage: "choose", kind: null, saving: false };
    case "open-kind":
    case "select-kind":
      return { open: true, stage: "compose", kind: action.kind, saving: false };
    case "back":
      return state.saving ? state : { ...state, stage: "choose", kind: null };
    case "set-saving":
      return { ...state, saving: action.saving };
    case "close":
      return state.saving ? state : initialCaptureOverlayState;
  }
}
