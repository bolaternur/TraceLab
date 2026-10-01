"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UiText } from "@/components/locale-provider";
import { addRelation } from "@/server/actions";
import { TraceCanvas } from "@/components/evidence-trace/trace-canvas";
import { TraceInspector } from "@/components/evidence-trace/trace-inspector";
import { TraceList } from "@/components/evidence-trace/trace-list";
import { TraceMobile } from "@/components/evidence-trace/trace-mobile";
import type { EvidenceTraceSnapshot } from "@/components/evidence-trace/types";

export function GraphView({ snapshot, initialSelectedId, storageKey, canConnect }: { snapshot: EvidenceTraceSnapshot; initialSelectedId: string | null; storageKey: string; canConnect: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [fromId, setFromId] = useState(initialSelectedId ?? "");
  const [toId, setToId] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const connectButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  return (
    <div className="canvas-view">
      <div className="canvas-graph-stage">
        <TraceCanvas snapshot={snapshot} selectedId={selectedId} initialFocusId={initialSelectedId} onSelect={setSelectedId} storageKey={storageKey} />
        {selectedId && <div className="canvas-inspector"><TraceInspector snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} onClose={() => setSelectedId(null)} /></div>}
      </div>
      <TraceMobile snapshot={snapshot} initialSelectedId={initialSelectedId} />
      <div className="canvas-secondary-tools">
        {canConnect && <button ref={connectButton} className="btn btn-primary" type="button" disabled={snapshot.nodes.length < 2} onClick={() => { setFromId(selectedId ?? ""); setToId(""); setError(false); dialog.current?.showModal(); }}><UiText text="Connect records" /></button>}
        <details className="canvas-record-list"><summary className="btn"><UiText text="List view" /></summary><div><TraceList snapshot={snapshot} selectedId={selectedId} onSelect={setSelectedId} /></div></details>
      </div>
      <dialog ref={dialog} className="connection-dialog" aria-labelledby="connection-title" onClose={() => connectButton.current?.focus()} onCancel={(event) => { if (pending) event.preventDefault(); }}>
        <h2 id="connection-title" className="text-xl font-medium"><UiText text="Connect records" /></h2>
        <form onSubmit={(event) => {
          event.preventDefault();
          const source = snapshot.nodes.find(node => node.id === fromId);
          const target = snapshot.nodes.find(node => node.id === toId);
          if (!source || !target || fromId === toId) return;
          const data = new FormData(event.currentTarget);
          data.set("fromId", source.id); data.set("fromType", source.kind);
          data.set("toId", target.id); data.set("toType", target.kind);
          data.set("returnTo", "/app/graph");
          setError(false);
          startTransition(async () => {
            try { await addRelation(data); router.refresh(); dialog.current?.close(); }
            catch { setError(true); }
          });
        }}>
          <label className="label"><UiText text="From record" /><select className="select" value={fromId} onChange={event => setFromId(event.target.value)} required disabled={pending}><option value="">—</option>{snapshot.nodes.map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>
          <label className="label"><UiText text="To record" /><select className="select" value={toId} onChange={event => setToId(event.target.value)} required disabled={pending}><option value="">—</option>{snapshot.nodes.filter(node => node.id !== fromId).map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>
          <label className="label"><UiText text="Relation type" /><select className="select" name="relationType" disabled={pending}><option value="RELATED_TO"><UiText text="Related to" /></option><option value="SUPPORTS"><UiText text="Supports" /></option><option value="LEADS_TO"><UiText text="Leads to" /></option><option value="CONTRADICTS"><UiText text="Contradicts" /></option><option value="SUPERSEDES"><UiText text="Supersedes" /></option></select></label>
          {error && <p role="alert" className="text-danger"><UiText text="Connection could not be saved. Please retry." /></p>}
          <div className="flex gap-2"><button type="submit" className="btn btn-primary" disabled={pending || !fromId || !toId || fromId === toId}><UiText text={pending ? "Saving…" : "Save connection"} /></button><button type="button" className="btn" disabled={pending} onClick={() => dialog.current?.close()}><UiText text="Cancel" /></button></div>
        </form>
      </dialog>
    </div>
  );
}
