"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { WorkbenchSnapshot } from "./types";

const WorkbenchSnapshotContext = createContext<WorkbenchSnapshot | null>(null);

export function WorkbenchSnapshotProvider({ snapshot, children }: { snapshot: WorkbenchSnapshot; children: ReactNode }) {
  return <WorkbenchSnapshotContext.Provider value={snapshot}>{children}</WorkbenchSnapshotContext.Provider>;
}

export function useWorkbenchSnapshot(): WorkbenchSnapshot {
  const snapshot = useContext(WorkbenchSnapshotContext);
  if (!snapshot) throw new Error("useWorkbenchSnapshot must be used inside WorkbenchSnapshotProvider");
  return snapshot;
}
