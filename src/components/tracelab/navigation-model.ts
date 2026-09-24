export interface NavigationItemModel {
  href: string;
  label: string;
  glyph: string;
  exact?: boolean;
  badge?: number;
}

export interface NavigationGroupModel {
  id: "project" | "memory" | "output" | "team";
  label: string;
  items: NavigationItemModel[];
}

export interface NavigationModel {
  today: NavigationItemModel;
  capture: NavigationItemModel;
  mobile: NavigationItemModel[];
  groups: NavigationGroupModel[];
}

export function buildNavigationModel({ isCoach, hasOrganization, unread = 0 }: { isCoach: boolean; hasOrganization: boolean; unread?: number }): NavigationModel {
  const today: NavigationItemModel = { href: "/app", label: "Today", glyph: "today", exact: true };
  const capture: NavigationItemModel = { href: "/app/capture", label: "Capture", glyph: "capture" };
  const timeline: NavigationItemModel = { href: "/app/timeline", label: "Timeline", glyph: "timeline" };
  const memory: NavigationItemModel = { href: "/app/memory", label: "Memory", glyph: "memory" };

  const groups: NavigationGroupModel[] = [
    {
      id: "project",
      label: "Project",
      items: [
        timeline,
        { href: "/app/inbox", label: "Evidence", glyph: "evidence" },
        { href: "/app/tests", label: "Tests", glyph: "test" },
        { href: "/app/decisions", label: "Decisions", glyph: "decision" },
      ],
    },
    {
      id: "memory",
      label: "Memory",
      items: [
        memory,
        { href: "/app/search", label: "Search", glyph: "search" },
        { href: "/app/graph", label: "Trace graph", glyph: "graph" },
        { href: "/app/failures", label: "Prior failures", glyph: "failure" },
        { href: "/app/handoff", label: "Handoff", glyph: "handoff" },
      ],
    },
    {
      id: "output",
      label: "Output",
      items: [
        { href: "/app/exports", label: "Portfolio & export", glyph: "export" },
        { href: "/app/competition", label: "Competition mode", glyph: "policy" },
        { href: "/app/research", label: "Research proof", glyph: "research" },
      ],
    },
    {
      id: "team",
      label: "Team",
      items: [
        { href: "/app/integrations", label: "Integrations", glyph: "integration" },
        { href: "/app/members", label: "Members", glyph: "members" },
        ...(isCoach ? [{ href: "/app/coach", label: "Coach view", glyph: "coach" }] : []),
        ...(hasOrganization ? [{ href: "/app/org", label: "Organization", glyph: "org" }] : []),
        { href: "/app/notifications", label: "Notifications", glyph: "notification", badge: unread || undefined },
        { href: "/app/settings", label: "Settings", glyph: "settings" },
      ],
    },
  ];

  return {
    today,
    capture,
    mobile: [today, timeline, memory],
    groups,
  };
}
