export type EvidenceTraceKind = "source_event" | "iteration" | "test" | "decision";
export type EvidenceTraceRelationStatus = "accepted" | "suggested" | "rejected" | string;

export interface EvidenceTraceNode {
  id: string;
  kind: EvidenceTraceKind;
  label: string;
  detail: string | null;
  occurredAt: string | null;
  subsystemId: string | null;
  outcome: string | null;
  provider: string | null;
}

export interface EvidenceTraceRelation {
  id: string;
  fromId: string;
  toId: string;
  type: string;
  origin: string;
  status: EvidenceTraceRelationStatus;
}

export interface EvidenceTraceSnapshot {
  nodes: EvidenceTraceNode[];
  relations: EvidenceTraceRelation[];
}

export interface PositionedEvidenceTraceNode extends EvidenceTraceNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EvidenceTraceLayout {
  nodes: PositionedEvidenceTraceNode[];
  relations: EvidenceTraceRelation[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  };
}
