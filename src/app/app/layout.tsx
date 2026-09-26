import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireTeam } from "@/server/auth";
import { isLocale, translate, type TranslationKey } from "@/lib/i18n";
import { loadTeamPolicy } from "@/server/policy";
import { MobileNav, type NavGroup, type NavItem } from "@/components/nav";
import { buildNavigationModel } from "@/components/tracelab/navigation-model";
import { ToolRail } from "@/components/workbench/tool-rail";
import { SecondaryRouteFrame } from "@/components/workbench/secondary-route-frame";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const ctx = await requireTeam();
  const jar = await cookies();
  const raw = jar.get("pt_lang")?.value ?? ctx.user.locale;
  const locale = isLocale(raw) ? raw : "en";
  const t = (key: TranslationKey) => translate(locale, key);
  const unread = (await db.select({ n: count() }).from(notifications).where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt))))[0].n;
  await loadTeamPolicy(ctx.team);
  const model = buildNavigationModel({ isCoach: ctx.isCoach, hasOrganization: Boolean(ctx.team.organizationId), unread: Number(unread) || 0 });

  const hrefLabels: Record<string, string> = {
    "/app": t("nav.home"),
    "/app/capture": t("nav.capture"),
    "/app/inbox": t("nav.inbox"),
    "/app/tests": t("nav.tests"),
    "/app/decisions": t("nav.decisions"),
    "/app/graph": t("nav.graph"),
    "/app/timeline": t("nav.timeline"),
    "/app/models": t("nav.models"),
    "/app/failures": t("nav.failures"),
    "/app/search": t("nav.search"),
    "/app/memory": t("nav.memory"),
    "/app/handoff": t("nav.handoff"),
    "/app/competition": t("nav.competition"),
    "/app/exports": t("nav.exports"),
    "/app/integrations": t("nav.integrations"),
    "/app/members": t("nav.members"),
    "/app/coach": t("nav.coach"),
    "/app/org": t("nav.org"),
    "/app/notifications": t("nav.notifications"),
    "/app/settings": t("nav.settings"),
  };
  const localize = (item: NavItem): NavItem => ({ ...item, label: hrefLabels[item.href] ?? item.label });
  const groupLabels: Record<string, string> = {
    project: t("section.evidence"),
    memory: t("section.memory"),
    output: t("section.competition"),
    team: t("section.team"),
  };
  const groups: NavGroup[] = model.groups.map((group) => ({ title: groupLabels[group.id] ?? group.label, items: group.items.map(localize) }));
  const today = localize(model.today);
  const capture = localize(model.capture);
  const mobilePrimary = model.mobile.map(localize);

  return (
    <div className="flex min-h-dvh bg-canvas">
      <ToolRail groups={groups} today={today} capture={capture} />
      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        <MobileNav groups={groups} teamName={ctx.team.name} primary={mobilePrimary} capture={capture} canCapture={ctx.canAuthorStudentContent} />
        <SecondaryRouteFrame>{children}</SecondaryRouteFrame>
      </div>
    </div>
  );
}
