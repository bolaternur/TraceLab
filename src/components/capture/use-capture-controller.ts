"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  blobToBase64,
  newClientId,
  outbox,
  prepareImage,
  syncOutbox,
  type OutboxItem,
} from "@/lib/outbox";
import { captureSyncState, validateCaptureDraft, type CaptureKind } from "./model";

export interface CaptureSavedResult {
  clientId: string;
  kind: CaptureKind;
  syncState: "synced" | "local";
}

export interface CaptureToast {
  tone: "ok" | "warn" | "err";
  text: string;
}

interface UseCaptureControllerInput {
  teamId: string;
  kind: CaptureKind;
  onSaved?: (result: CaptureSavedResult) => void;
}

export function useCaptureController({ teamId, kind, onSaved }: UseCaptureControllerInput) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState<OutboxItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<CaptureToast | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const revokePreviewUrl = useCallback(() => {
    if (!previewUrlRef.current) return;
    URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  }, []);

  const clearPreview = useCallback(() => {
    revokePreviewUrl();
    setPreview(null);
  }, [revokePreviewUrl]);

  const selectPhoto = useCallback((file: File | null) => {
    revokePreviewUrl();
    if (!file) {
      setPreview(null);
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setPreview(nextUrl);
  }, [revokePreviewUrl]);

  const refresh = useCallback(async () => setPending(await outbox.all()), []);
  const trySync = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine) {
      const remaining = (await outbox.all()).length;
      return { synced: 0, failed: 0, remaining };
    }
    const result = await syncOutbox();
    await refresh();
    if (result.synced) setToast({ tone: "ok", text: `Synced ${result.synced} capture${result.synced > 1 ? "s" : ""}.` });
    return result;
  }, [refresh]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      void refresh();
      void trySync();
    });
    const on = () => {
      setOnline(true);
      void trySync();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [refresh, trySync]);

  useEffect(() => () => revokePreviewUrl(), [revokePreviewUrl]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (fileRef.current) fileRef.current.value = "";
      clearPreview();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [kind, clearPreview]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const fields: Record<string, string> = {};
    for (const [key, value] of fd.entries()) if (typeof value === "string" && value !== "") fields[key] = value;
    fields.kind = kind;
    fields.occurredAt = new Date().toISOString();
    const file = fileRef.current?.files?.[0] ?? null;
    const validation = validateCaptureDraft(kind, fields, Boolean(file));
    if (!validation.ok) {
      setToast({ tone: "err", text: validation.message });
      return;
    }

    const clientId = newClientId();
    let photo: OutboxItem["photo"] = null;
    let savedResult: CaptureSavedResult | null = null;
    setBusy(true);
    try {
      if (file) {
        const blob = await prepareImage(file);
        photo = { name: file.name || "capture.jpg", type: "image/jpeg", dataBase64: await blobToBase64(blob) };
      }
      const item: OutboxItem = {
        clientId,
        teamId,
        createdAt: fields.occurredAt,
        fields,
        photo,
        status: "pending",
        attempts: 0,
      };

      // Local persistence is the durable first write. Network loss after this line cannot erase the capture.
      await outbox.add(item);
      await refresh();
      form.reset();
      if (fileRef.current) fileRef.current.value = "";
      clearPreview();

      if (navigator.onLine) {
        await syncOutbox();
        const remainingItems = await outbox.all();
        setPending(remainingItems);
        const syncState = captureSyncState(clientId, remainingItems);
        if (syncState === "local") {
          setToast({ tone: "warn", text: "Saved locally. Server unreachable — will retry." });
        } else {
          setToast({ tone: "ok", text: "Saved and synced." });
        }
        savedResult = { clientId, kind, syncState };
      } else {
        setToast({ tone: "warn", text: "Saved on this device. It will sync automatically when you reconnect." });
        savedResult = { clientId, kind, syncState: "local" };
      }
    } catch (err) {
      setToast({ tone: "err", text: `Could not save: ${String(err)}` });
    } finally {
      setBusy(false);
    }

    if (savedResult) onSaved?.(savedResult);
  }

  return {
    online,
    pending,
    failed: pending.filter((item) => item.status === "failed"),
    busy,
    toast,
    preview,
    selectPhoto,
    fileRef,
    trySync,
    onSubmit,
  };
}
