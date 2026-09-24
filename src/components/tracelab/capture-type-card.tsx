import { TraceIcon, type TraceIconName } from "./trace-icon";

export interface CaptureTypeCardProps {
  label: string;
  hint: string;
  description: string;
  icon: TraceIconName;
  selected: boolean;
  onSelect: () => void;
}

export function CaptureTypeCard({ label, hint, description, icon, selected, onSelect }: CaptureTypeCardProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onSelect}
      className={`group min-w-[136px] rounded-[18px] border p-3 text-left transition-[border-color,background-color,color,box-shadow] duration-150 sm:min-w-0 ${
        selected
          ? "border-blueprint bg-blueprint text-white shadow-[0_10px_24px_rgb(65_105_255_/_0.16)]"
          : "border-border bg-surface text-ink hover:border-border-strong"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${selected ? "bg-white/14 text-white" : "bg-canvas text-text-2"}`}>
          <TraceIcon name={icon} size={18} />
        </span>
        {hint ? <span className={`trace-meta text-[9px] uppercase ${selected ? "text-white/65" : "text-text-3"}`}>{hint}</span> : null}
      </div>
      <div className="mt-3 text-sm font-semibold">{label}</div>
      <div className={`mt-1 line-clamp-2 text-[11px] leading-4 ${selected ? "text-white/72" : "text-text-3"}`}>{description}</div>
    </button>
  );
}
