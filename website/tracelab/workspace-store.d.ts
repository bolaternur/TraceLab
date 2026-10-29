export interface WorkspaceRecord {
  id: string; kind: "source" | "iteration" | "test" | "decision"; title: string; body: string; author: string; createdAt: string;
  rationale?: string; status?: "draft" | "closed"; sourceType?: string; revision?: string; unit?: string;
  outcome?: "kept" | "reverted" | "iterate" | "deferred" | "rejected"; nextStep?: string;
  criterion?: string; conditions?: string; measuredValue?: number; trials?: number; successes?: number;
  originalAuthorLabel?: string; authorProvenance?: string; recordHistory?: unknown; annotationHistory?: unknown[];
  [key: string]: unknown;
}
export interface WorkspaceLink { id: string; from: string; to: string; label: string; relationType?: string; origin?: string; status: "accepted" | "suggested" | "rejected"; }
export interface WorkspaceProject {
  id: string; name: string; description: string; dataKind: "personal" | "synthetic"; educationalOrigin?: boolean;
  records: WorkspaceRecord[]; links: WorkspaceLink[]; studyRows: Array<Record<string, unknown>>;
  nodePositions?: Record<string, {x:number;y:number}>; importManifest?: unknown; importWarnings?: string[];
  annotationHistory?: unknown[]; serverRevision?: number;
  hiddenRecordIds?: string[];
}
export interface WorkspaceState { schemaVersion: 1; activeProjectId: string; projects: WorkspaceProject[]; }
export interface WorkspaceStore {
 getState():WorkspaceState; getProject():WorkspaceProject; createProject(fields:unknown):string; selectProject(id:string):void;
 addRecord(fields:unknown):string; updateRecord(id:string,fields:unknown):void; addLink(fields:unknown):string; removeLink(id:string):void;
 hideRecord(id:string):void; restoreRecord(id:string):void;
 setNodePosition(id:string,position:unknown):void; resetNodePositions():void; addStudyRow(fields:unknown):string; addStudyRows(fields:unknown):string[];
 importProject(text:string):string; exportProject():string; readonly storageStatus:string; readonly storageMessage:string;
}
export function createWorkspaceStore(options?: {storage?: {getItem(key:string):string|null;setItem(key:string,value:string):void}|null;eventTarget?:null;idFactory?:(prefix:string)=>string;now?:()=>string}):WorkspaceStore;
export const STORAGE_KEY:string;
export const LIMITS:Readonly<{projects:number;records:number;links:number;studyRows:number;annotations:number;recordVersions:number;importBytes:number;stateCharacters:number}>;
export const store:WorkspaceStore;
export default store;

