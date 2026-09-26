import "dotenv/config";
import { and, desc, eq } from "drizzle-orm";
import { db, pool } from "../src/db/index";
import { projects, seasons, teamMemberships, users } from "../src/db/schema";
import { seedDemoModels } from "../src/db/seed-models";

const [lead] = await db.select({ id: users.id }).from(users).where(eq(users.email, "lead@trace.demo")).limit(1);
if (!lead) throw new Error("Demo lead user is missing. Run npm run db:seed first.");
const [membership] = await db.select({ teamId: teamMemberships.teamId }).from(teamMemberships).where(and(eq(teamMemberships.userId, lead.id), eq(teamMemberships.status, "active"))).limit(1);
if (!membership) throw new Error("Demo lead has no active team.");
const [project] = await db
  .select({ id: projects.id })
  .from(projects)
  .innerJoin(seasons, eq(seasons.id, projects.seasonId))
  .where(and(eq(projects.teamId, membership.teamId), eq(seasons.isActive, true)))
  .orderBy(desc(seasons.year))
  .limit(1);

await seedDemoModels({ teamId: membership.teamId, userId: lead.id, projectId: project?.id });
console.log("Imported TraceLab seed 3D models into private team storage.");
await pool.end();
