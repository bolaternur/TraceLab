"use client";

import { CaptureTypeCard } from "@/components/tracelab/capture-type-card";
import { CAPTURE_KINDS, type CaptureKind } from "./model";

interface CaptureKindPickerProps {
  value: CaptureKind;
  onChange: (kind: CaptureKind) => void;
  compact?: boolean;
}

export function CaptureKindPicker({ value, onChange, compact = false }: CaptureKindPickerProps) {
  return (
    <div
      role="tablist"
      aria-label="Capture type"
      className={compact
        ? "flex gap-2 overflow-x-auto pb-1"
        : "-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0"}
    >
      {CAPTURE_KINDS.map((item) => (
        <CaptureTypeCard
          key={item.kind}
          label={item.label}
          hint={item.hint}
          description={compact ? "" : item.description}
          icon={item.icon}
          selected={value === item.kind}
          onSelect={() => onChange(item.kind)}
        />
      ))}
    </div>
  );
}
