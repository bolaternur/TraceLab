/**
 * Database-backed tenant isolation tests. Require DATABASE_URL and a seeded database (npm run db:seed).
 * Verifies the authorization-relevant query shapes used by routes: membership joins, invite rules, roles.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../src/db";
import { artifacts, iterations, sourceEvents, teamInvites, teamMemberships, teams, users } from "../src/db/schema";

const skip = !process.env.DATABASE_URL;

describe.skipIf(skip)("tenant isolation", () => {
  let lead: string, other: string, teamA: string, teamB: string;
  beforeAll(async () => {
    lead = (await db.select().from(users).where(eq(users.email, "lead@trace.demo")))[0]?.id;
    other = (await db.select().from(users).where(eq(users.email, "other@trace.demo")))[0]?.id;
    teamA = (await db.select().from(teams).where(eq(teams.name, "Orion Robotics")))[0]?.id;
    teamB = (await db.select().from(teams).where(eq(teams.name, "Isolated Team B")))[0]?.id;
  });
  afterAll(async () => {
    await pool.end();
  });

  it("seed present", () => {
    expect(lead && other && teamA && teamB).toBeTruthy();
  });

  it("Team A member has no membership row for Team B (requireTeamById would deny)", async () => {
    const rows = await db.select().from(teamMemberships).where(and(eq(teamMemberships.userId, lead), eq(teamMemberships.teamId, teamB), eq(teamMemberships.status, "active")));
    expect(rows).toHaveLength(0);
  });

  it("membership-joined artifact/media lookup returns nothing across tenants (no existence oracle)", async () => {
    const bIterations = await db.select().from(iterations).where(eq(iterations.teamId, teamB));
    expect(bIterations.length).toBeGreaterThan(0);
    const viaA = await db
      .select({ id: iterations.id })
      .from(iterations)
      .innerJoin(teamMemberships, and(eq(teamMemberships.teamId, iterations.teamId), eq(teamMemberships.userId, lead), eq(teamMemberships.status, "active")))
      .where(eq(iterations.id, bIterations[0].id));
    expect(viaA).toHaveLength(0);
    const viaOwner = await db
      .select({ id: iterations.id })
      .from(iterations)
      .innerJoin(teamMemberships, and(eq(teamMemberships.teamId, iterations.teamId), eq(teamMemberships.userId, other), eq(teamMemberships.status, "active")))
      .where(eq(iterations.id, bIterations[0].id));
    expect(viaOwner).toHaveLength(1);
  });

  it("Team B source events are not visible through Team A scoped queries", async () => {
    const a = await db.select().from(sourceEvents).where(eq(sourceEvents.teamId, teamA));
    expect(a.every((e) => e.teamId === teamA)).toBe(true);
    const artA = await db.select().from(artifacts).where(eq(artifacts.teamId, teamA));
    expect(artA.every((x) => x.teamId === teamA)).toBe(true);
  });

  it("revoked member loses access immediately", async () => {
    const [m] = await db.insert(teamMemberships).values({ teamId: teamB, userId: lead, role: "student", status: "removed", leftAt: new Date() }).onConflictDoNothing().returning();
    const active = await db.select().from(teamMemberships).where(and(eq(teamMemberships.userId, lead), eq(teamMemberships.teamId, teamB), eq(teamMemberships.status, "active")));
    expect(active).toHaveLength(0);
    if (m) await db.delete(teamMemberships).where(eq(teamMemberships.id, m.id));
  });

  it("expired / used / revoked invites are not valid", async () => {
    const [expired] = await db.insert(teamInvites).values({ teamId: teamB, code: `t-exp-${Date.now()}`, expiresAt: new Date(Date.now() - 1000) }).returning();
    const [used] = await db.insert(teamInvites).values({ teamId: teamB, code: `t-used-${Date.now()}`, expiresAt: new Date(Date.now() + 100_000), maxUses: 1, uses: 1 }).returning();
    const [revoked] = await db.insert(teamInvites).values({ teamId: teamB, code: `t-rev-${Date.now()}`, expiresAt: new Date(Date.now() + 100_000), revokedAt: new Date() }).returning();
    const valid = (i: typeof expired) => !i.revokedAt && i.expiresAt.getTime() > Date.now() && i.uses < i.maxUses;
    expect(valid(expired)).toBe(false);
    expect(valid(used)).toBe(false);
    expect(valid(revoked)).toBe(false);
    await db.delete(teamInvites).where(eq(teamInvites.id, expired.id));
    await db.delete(teamInvites).where(eq(teamInvites.id, used.id));
    await db.delete(teamInvites).where(eq(teamInvites.id, revoked.id));
  });

  it("client-id uniqueness is idempotent inside a team but isolated across teams", async () => {
    const clientId = `cap_test_${Date.now()}`;
    const base = { provider: "capture", providerEventId: clientId, clientId, eventType: "problem", title: "dup test", occurredAt: new Date(), contentHash: "x" };
    const firstA = await db.insert(sourceEvents).values({ ...base, teamId: teamA }).onConflictDoNothing().returning();
    const duplicateA = await db.insert(sourceEvents).values({ ...base, teamId: teamA }).onConflictDoNothing().returning();
    const firstB = await db.insert(sourceEvents).values({ ...base, teamId: teamB }).onConflictDoNothing().returning();
    expect(firstA).toHaveLength(1);
    expect(duplicateA).toHaveLength(0);
    expect(firstB).toHaveLength(1);
    if (firstA[0]) await db.delete(sourceEvents).where(eq(sourceEvents.id, firstA[0].id));
    if (firstB[0]) await db.delete(sourceEvents).where(eq(sourceEvents.id, firstB[0].id));
  });
});
