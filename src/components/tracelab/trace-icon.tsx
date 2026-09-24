import type { SVGProps } from "react";

export type TraceIconName =
  | "today" | "capture" | "timeline" | "evidence" | "test" | "decision" | "memory" | "search" | "graph"
  | "failure" | "handoff" | "export" | "policy" | "integration" | "members" | "coach" | "org" | "notification"
  | "settings" | "research" | "menu" | "close" | "photo" | "problem" | "reflection" | "sync" | "offline" | "branch" | "cad" | "more";

interface TraceIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: TraceIconName | string;
  size?: number;
}

export function TraceIcon({ name, size = 18, className = "", ...props }: TraceIconProps) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icon = (() => {
    switch (name) {
      case "today": return <><path d="M4 7.5h16M7 4v3M17 4v3M6 11h4v4H6z" {...common}/><path d="M5 6h14a1 1 0 0 1 1 1v12H4V7a1 1 0 0 1 1-1Z" {...common}/></>;
      case "capture": return <><circle cx="12" cy="12" r="7" {...common}/><circle cx="12" cy="12" r="2.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" {...common}/></>;
      case "timeline": return <><path d="M6 4v16" {...common}/><circle cx="6" cy="7" r="2" fill="currentColor"/><circle cx="6" cy="13" r="2" fill="currentColor"/><circle cx="6" cy="19" r="2" fill="currentColor"/><path d="M10 7h9M10 13h6M10 19h8" {...common}/></>;
      case "evidence": return <><path d="M5 4h14v16H5z" {...common}/><path d="M8 8h8M8 12h6M8 16h7" {...common}/></>;
      case "test": return <><path d="M9 3h6M10 3v5l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" {...common}/><path d="M8 15h8" {...common}/></>;
      case "decision": return <path d="M12 3 21 12 12 21 3 12 12 3Z" {...common}/>;
      case "memory": return <><path d="M5 9a7 7 0 1 1 1 9" {...common}/><path d="M5 4v5h5" {...common}/><path d="M12 8v4l3 2" {...common}/></>;
      case "search": return <><circle cx="10.5" cy="10.5" r="6.5" {...common}/><path d="m16 16 5 5" {...common}/></>;
      case "graph": return <><circle cx="6" cy="6" r="2" {...common}/><circle cx="18" cy="8" r="2" {...common}/><circle cx="10" cy="18" r="2" {...common}/><path d="m8 7 8 1.5M7 8l2.5 8M16.5 10l-5 6.5" {...common}/></>;
      case "failure": return <><circle cx="12" cy="12" r="9" {...common}/><path d="m9 9 6 6M15 9l-6 6" {...common}/></>;
      case "handoff": return <><path d="M3 8h10M10 5l3 3-3 3M21 16H11M14 13l-3 3 3 3" {...common}/></>;
      case "export": return <><path d="M12 3v12M8 11l4 4 4-4" {...common}/><path d="M5 19h14" {...common}/></>;
      case "policy": return <><path d="M12 3 19 6v5c0 4.5-2.8 7.8-7 10-4.2-2.2-7-5.5-7-10V6l7-3Z" {...common}/><path d="m9 12 2 2 4-5" {...common}/></>;
      case "integration": return <><path d="M8 8 5 5M16 16l3 3M7 17l10-10" {...common}/><circle cx="6" cy="18" r="2" {...common}/><circle cx="18" cy="6" r="2" {...common}/></>;
      case "members": return <><circle cx="9" cy="9" r="3" {...common}/><circle cx="17" cy="10" r="2.5" {...common}/><path d="M3 20c.7-4 2.8-6 6-6s5.3 2 6 6M15 15c2.8 0 4.7 1.7 5.3 5" {...common}/></>;
      case "coach": return <><circle cx="12" cy="8" r="3" {...common}/><path d="M5 20c.8-5 3.1-7 7-7s6.2 2 7 7" {...common}/><path d="M18 5h3v6" {...common}/></>;
      case "org": return <><path d="M4 21V8l8-4 8 4v13" {...common}/><path d="M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" {...common}/></>;
      case "notification": return <><path d="M6 17h12l-1.5-2.5V10a4.5 4.5 0 0 0-9 0v4.5L6 17Z" {...common}/><path d="M10 20h4" {...common}/></>;
      case "settings": return <><circle cx="12" cy="12" r="3" {...common}/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" {...common}/></>;
      case "research": return <><path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-8V3" {...common}/><path d="M7.8 15h8.4M9.5 12h5" {...common}/><circle cx="12" cy="17" r="1" fill="currentColor"/></>;
      case "menu": return <path d="M4 7h16M4 12h16M4 17h16" {...common}/>;
      case "close": return <path d="m6 6 12 12M18 6 6 18" {...common}/>;
      case "photo": return <><rect x="3" y="5" width="18" height="14" rx="2" {...common}/><circle cx="9" cy="10" r="2" {...common}/><path d="m5 17 5-5 3 3 2-2 4 4" {...common}/></>;
      case "problem": return <><circle cx="12" cy="12" r="9" {...common}/><path d="M12 7v6M12 17h.01" {...common}/></>;
      case "reflection": return <><path d="M5 19h4l10-10-4-4L5 15v4Z" {...common}/><path d="m13.5 6.5 4 4" {...common}/></>;
      case "sync": return <><path d="M19 7v5h-5M5 17v-5h5" {...common}/><path d="M17.5 12a6 6 0 0 0-10-4.5L5 10M6.5 12a6 6 0 0 0 10 4.5L19 14" {...common}/></>;
      case "offline": return <><path d="M5 9.5A9 9 0 0 1 19 10M8 13a5.5 5.5 0 0 1 8 0M11 16a2 2 0 0 1 2 0" {...common}/><path d="M4 4l16 16" {...common}/></>;
      case "branch": return <><circle cx="7" cy="5" r="2" {...common}/><circle cx="17" cy="7" r="2" {...common}/><circle cx="7" cy="19" r="2" {...common}/><path d="M7 7v10M9 12c4 0 6-1 6-3" {...common}/></>;
      case "cad": return <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" {...common}/><path d="m4.5 7.8 7.5 4.3 7.5-4.3M12 12v9" {...common}/></>;
      case "more": return <><circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/></>;
      default: return <circle cx="12" cy="12" r="7" {...common}/>;
    }
  })();
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden {...props}>{icon}</svg>;
}
