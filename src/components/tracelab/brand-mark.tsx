import type { SVGProps } from "react";

export function TraceMark({ className = "", ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 44 44" fill="none" className={className} aria-hidden {...props}>
      <image href="/brand/iznera-mark.svg" width="44" height="44" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}
