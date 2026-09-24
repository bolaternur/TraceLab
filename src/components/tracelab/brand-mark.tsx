import type { SVGProps } from "react";

export function TraceMark({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 44 44" fill="none" className={className} aria-hidden {...props}>
      <path d="M8 12h10v8h9v12h9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="8" cy="12" r="4" fill="currentColor" />
      <rect x="15" y="17" width="7" height="7" rx="1.5" fill="var(--signal-lime)" stroke="currentColor" strokeWidth="1.6" />
      <path d="M27 28l4 4-4 4-4-4 4-4Z" fill="var(--test-orange)" stroke="currentColor" strokeWidth="1.5" />
      <path d="M36 28l4 4-4 4-4-4 4-4Z" fill="var(--decision-violet)" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
