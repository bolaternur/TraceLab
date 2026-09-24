import { TraceIcon } from "./trace-icon";

export interface SyncStatusProps {
  online: boolean;
  pendingCount: number;
  failedCount: number;
  onSync: () => void;
}

export function SyncStatus({ online, pendingCount, failedCount, onSync }: SyncStatusProps) {
  const state = failedCount > 0 ? "error" : !online ? "offline" : pendingCount > 0 ? "pending" : "synced";
  const copy = state === "error" ? `${failedCount} need attention` : state === "offline" ? "Saved locally" : state === "pending" ? `${pendingCount} waiting to sync` : "All captures synced";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${state === "error" ? "bg-danger-bg text-danger" : state === "offline" || state === "pending" ? "bg-warning-bg text-warning" : "bg-success-bg text-success"}`}>
          <TraceIcon name={state === "offline" ? "offline" : "sync"} size={15} />
        </span>
        <div>
          <div className="font-semibold">{copy}</div>
          <div className="text-[10px] text-text-3">{online ? "Device is online" : "Uploads resume automatically when connected"}</div>
        </div>
      </div>
      {online && pendingCount > 0 ? <button type="button" className="font-semibold text-blueprint" onClick={onSync}>Sync now</button> : null}
    </div>
  );
}
