import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { db } from "@/db";
import { sessions, teamMemberships, teams, users, organizationMemberships } from "@/db/schema";
import { cache } from "react";

const SESSION_COOKIE = "pt_session";
const TEAM_COOKIE = "pt_team";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function createSession(userId: string) {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIES !== "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) await db.delete(sessions).where(eq(sessions.id, id));
  jar.delete(SESSION_COOKIE);
  jar.delete(TEAM_COOKIE);
}

export type SessionUser = typeof users.$inferSelect;

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  if (process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "true") {
    const email = process.env.DEV_AUTH_EMAIL ?? "lead@trace.demo";
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = rows[0];
    if (!user) {
      throw new Error(`DEV_AUTH_BYPASS: ${email} was not found. Run npm run db:seed first.`);
    }
    return user;
  }

  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const rows = await db
    .select({ user: users, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  return row.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth?mode=signin");
  return user;
}

export type TeamRole = "student" | "student_lead" | "coach";

export interface TeamContext {
  user: SessionUser;
  team: typeof teams.$inferSelect;
  role: TeamRole;
  orgRole: "admin" | "coach" | "member" | null;
  canOrganize: boolean; // student_lead, coach
  canAuthorStudentContent: boolean; // students only
  isCoach: boolean;
}

export const listUserTeams = cache(async (userId: string) => {
  return db
    .select({ team: teams, role: teamMemberships.role, status: teamMemberships.status })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(and(eq(teamMemberships.userId, userId), eq(teamMemberships.status, "active")));
});

export async function setCurrentTeamCookie(teamId: string) {
  const jar = await cookies();
  jar.set(TEAM_COOKIE, teamId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIES !== "true", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/**
 * Central tenancy gate. Every team-scoped page/action goes through here.
 * Membership is verified on every request; a revoked member is denied immediately.
 */
export const requireTeam = cache(async (): Promise<TeamContext> => {
  const user = await requireUser();
  const jar = await cookies();
  const wanted = jar.get(TEAM_COOKIE)?.value;
  const memberships = await listUserTeams(user.id);
  if (memberships.length === 0) redirect("/onboarding");
  const chosen = memberships.find((m) => m.team.id === wanted) ?? memberships[0];
  return buildContext(user, chosen.team, chosen.role as TeamRole);
});

export async function requireTeamById(teamId: string): Promise<TeamContext> {
  const user = await requireUser();
  const rows = await db
    .select({ team: teams, role: teamMemberships.role })
    .from(teamMemberships)
    .innerJoin(teams, eq(teams.id, teamMemberships.teamId))
    .where(and(eq(teamMemberships.userId, user.id), eq(teamMemberships.teamId, teamId), eq(teamMemberships.status, "active")))
    .limit(1);
  if (!rows[0]) throw new AuthorizationError("You are not a member of this team.");
  return buildContext(user, rows[0].team, rows[0].role as TeamRole);
}

async function buildContext(user: SessionUser, team: typeof teams.$inferSelect, role: TeamRole): Promise<TeamContext> {
  let orgRole: TeamContext["orgRole"] = null;
  if (team.organizationId) {
    const om = await db
      .select({ role: organizationMemberships.role })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.organizationId, team.organizationId), eq(organizationMemberships.userId, user.id)))
      .limit(1);
    orgRole = (om[0]?.role as TeamContext["orgRole"]) ?? null;
  }
  const isCoach = role === "coach" || orgRole === "admin" || orgRole === "coach";
  return {
    user,
    team,
    role,
    orgRole,
    canOrganize: role === "student_lead" || isCoach,
    canAuthorStudentContent: role === "student" || role === "student_lead",
    isCoach,
  };
}

export class AuthorizationError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function assertRole(ctx: TeamContext, allowed: Array<TeamRole | "org_admin">) {
  if (allowed.includes(ctx.role)) return;
  if (allowed.includes("org_admin") && ctx.orgRole === "admin") return;
  throw new AuthorizationError();
}

export function policyActorRole(ctx: TeamContext): "student" | "student_lead" | "coach" | "org_admin" | "platform_admin" {
  if (ctx.user.platformRole === "platform_admin") return "platform_admin";
  if (ctx.orgRole === "admin") return "org_admin";
  return ctx.role;
}
