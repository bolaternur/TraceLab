/* Realistic demo data: fictional FTC-style team "Orion Robotics" across two seasons. Run: npm run db:seed */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { createHash, scryptSync, randomBytes } from "node:crypto";
import { db, pool } from "./index";
import {
  annotations,
  competitionProfiles,
  decisions,
  featureFlags,
  iterations,
  organizationMemberships,
  organizations,
  policyVersions,
  projects,
  relations,
  seasons,
  sourceConnections,
  sourceEvents,
  subscriptions,
  subsystems,
  teamMemberships,
  teams,
  tests,
  users,
} from "./schema";
import { SEED_PROFILES } from "../modules/policies/engine";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function pw(p: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(p, salt, 64).toString("hex")}`;
}
const d = (s: string) => new Date(s);

export async function seedPolicies() {
  const ids: Record<string, string> = {};
  for (const p of SEED_PROFILES) {
    const [row] = await db
      .insert(competitionProfiles)
      .values({ key: p.key, program: p.program, name: p.name, description: p.description, strict: p.strict })
      .onConflictDoUpdate({ target: competitionProfiles.key, set: { name: p.name, description: p.description, strict: p.strict } })
      .returning();
    ids[p.key] = row.id;
    for (const v of p.versions) {
      await db
        .insert(policyVersions)
        .values({ profileId: row.id, version: v.version, status: v.status, effectiveFrom: v.effectiveFrom ? d(v.effectiveFrom) : null, reviewedAt: v.reviewedAt ? d(v.reviewedAt) : null, reviewer: v.reviewer, sourceUrls: v.sourceUrls, changelog: v.changelog, constraints: v.constraints, actionMatrix: v.actionMatrix })
        .onConflictDoNothing();
    }
  }
  await db.insert(featureFlags).values([{ key: "semantic_search", enabled: false, description: "Optional vector search (not authoritative)" }, { key: "voice_capture", enabled: false, description: "Voice capture with exact transcript" }]).onConflictDoNothing();
  return ids;
}

async function main() {
  const profileIds = await seedPolicies();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, "lead@trace.demo")).limit(1);
  if (existing[0]) {
    console.log("Demo data already present; policies refreshed.");
    await pool.end();
    return;
  }

  const [org] = await db.insert(organizations).values({ name: "Northline STEM Club", plan: "club" }).returning();
  await db.insert(subscriptions).values({ organizationId: org.id, plan: "club", status: "active", provider: "dev" });

  const mk = async (email: string, name: string) => (await db.insert(users).values({ email, passwordHash: pw("demo1234"), displayName: name }).returning())[0];
  const lead = await mk("lead@trace.demo", "Aruzhan S.");
  const anim = await mk("anim@trace.demo", "Anim K.");
  const dana = await mk("dana@trace.demo", "Dana T.");
  const coach = await mk("coach@trace.demo", "Coach Murat");
  const other = await mk("other@trace.demo", "Other Team Student");

  await db.insert(organizationMemberships).values([
    { organizationId: org.id, userId: coach.id, role: "admin" },
    { organizationId: org.id, userId: lead.id, role: "member" },
  ]);

  const [team] = await db.insert(teams).values({ organizationId: org.id, name: "Orion Robotics", number: "24601", program: "FTC", timezone: "Asia/Almaty", competitionProfileId: profileIds.ftc_2026_27, studentOwnedMode: true }).returning();
  const [teamB] = await db.insert(teams).values({ organizationId: null, name: "Isolated Team B", number: "99999", program: "VEX", timezone: "UTC", competitionProfileId: profileIds.vex_strict, studentOwnedMode: true }).returning();
  await db.insert(teamMemberships).values([
    { teamId: team.id, userId: lead.id, role: "student_lead" },
    { teamId: team.id, userId: anim.id, role: "student" },
    { teamId: team.id, userId: dana.id, role: "student" },
    { teamId: team.id, userId: coach.id, role: "coach" },
    { teamId: teamB.id, userId: other.id, role: "student_lead" },
  ]);

  // Team B minimal content (isolation target)
  const [sB] = await db.insert(seasons).values({ teamId: teamB.id, name: "2026 Season", year: 2026 }).returning();
  const [pB] = await db.insert(projects).values({ teamId: teamB.id, seasonId: sB.id, name: "Secret Bot" }).returning();
  const [subB] = await db.insert(subsystems).values({ teamId: teamB.id, projectId: pB.id, name: "Drivetrain" }).returning();
  await db.insert(iterations).values({ teamId: teamB.id, projectId: pB.id, subsystemId: subB.id, title: "Team B private iteration", createdBy: other.id });

  // ---- Season 2025 (previous): chain intake rejected ----
  const [s2025] = await db.insert(seasons).values({ teamId: team.id, name: "2025 Season", year: 2025, isActive: false, handoffCompletedAt: d("2025-06-20") }).returning();
  const [p2025] = await db.insert(projects).values({ teamId: team.id, seasonId: s2025.id, name: "Orion Mk I" }).returning();
  const [intake25] = await db.insert(subsystems).values({ teamId: team.id, projectId: p2025.id, name: "Intake" }).returning();
  const [chain] = await db.insert(iterations).values({ teamId: team.id, projectId: p2025.id, subsystemId: intake25.id, title: "Chain intake prototype", state: "closed", outcome: "rejected", problemOrGoal: "Pick up game pieces from the floor faster than the claw.", openedAt: d("2025-01-12"), closedAt: d("2025-01-30"), createdBy: dana.id }).returning();
  const [chainTest] = await db.insert(tests).values({ teamId: team.id, projectId: p2025.id, subsystemId: intake25.id, iterationId: chain.id, title: "Chain intake pickup reliability", targetType: "prototype", targetLabel: "Chain intake v1", question: "Does the chain intake pick up a piece reliably from floor level?", procedure: "Place piece 30 cm in front, drive forward at 40% power, run intake 2 s. 20 trials.", metricName: "success rate", trials: 20, successes: 8, outcome: "fail", passCriteria: ">= 15 / 20", observations: "Large backlash in the chain; piece bounced out on 7 trials.", performedAt: d("2025-01-25"), createdBy: dana.id }).returning();
  const [chainDecision] = await db.insert(decisions).values({ teamId: team.id, projectId: p2025.id, subsystemId: intake25.id, iterationId: chain.id, title: "Reject chain intake", disposition: "reject", decidedAt: d("2025-01-30"), authorUserId: dana.id, alternatives: ["Keep chain and add tensioner", "Switch to compliant rollers"] }).returning();
  await db.insert(relations).values({ teamId: team.id, fromType: "decision", fromId: chainDecision.id, toType: "test", toId: chainTest.id, relationType: "SUPPORTS", origin: "student", createdBy: dana.id });
  await db.insert(annotations).values([
    { teamId: team.id, entityType: "decision", entityId: chainDecision.id, field: "rationale", body: "Backlash in the chain let the piece bounce back out. 8/20 is far below our 15/20 target.", authorUserId: dana.id },
    { teamId: team.id, entityType: "iteration", entityId: chain.id, field: "next_step", body: "Do not retry chain intake unless a new tensioner design is used.", authorUserId: dana.id },
    { teamId: team.id, entityType: "subsystem", entityId: intake25.id, field: "handoff", body: "Intake was our weakest subsystem in 2025. Chain intake rejected; compliant rollers were only sketched. Start there.", authorUserId: lead.id },
  ]);

  // ---- Season 2026 (active): Orion ----
  const [s2026] = await db.insert(seasons).values({ teamId: team.id, name: "2026 Season", year: 2026, isActive: true }).returning();
  const [proj] = await db.insert(projects).values({ teamId: team.id, seasonId: s2026.id, name: "Orion", description: "2026 competition robot." }).returning();
  const subRows = await db.insert(subsystems).values(["Intake", "Drivetrain", "Lift", "Autonomous", "Vision"].map((name) => ({ teamId: team.id, projectId: proj.id, name }))).returning();
  const sub = Object.fromEntries(subRows.map((s) => [s.name, s.id]));

  await db.insert(sourceConnections).values([
    { teamId: team.id, provider: "github", label: "team/orion-robot", externalId: "team/orion-robot", status: "active", createdBy: lead.id, lastEventAt: d("2026-09-02T14:02:00Z"), config: { note: "seeded demo connection" } },
    { teamId: team.id, provider: "onshape", label: "Orion 2026 CAD", externalId: "d-orion", status: "pending", createdBy: lead.id, config: { note: "awaiting ONSHAPE_CLIENT_ID" } },
  ]);

  const now = Date.now();
  const daysAgo = (n: number, h = 12) => new Date(now - n * 86400_000 + (h - 12) * 3600_000);

  // Iteration 1: roller spacing
  const [it18] = await db.insert(iterations).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Intake, title: "Intake reliability — roller spacing", state: "closed", outcome: "kept", problemOrGoal: "Game piece occasionally jams between the intake rollers.", changeSummary: "Increased roller spacing from 32 mm to 36 mm.", openedAt: daysAgo(20), closedAt: daysAgo(9), createdBy: anim.id }).returning();
  const [t41] = await db.insert(tests).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Intake, iterationId: it18.id, title: "Intake pickup at 32 mm spacing", targetType: "revision", targetLabel: "CAD rev 21 (32 mm)", question: "How often does the intake capture a piece at 32 mm?", hypothesis: "Jams are caused by insufficient clearance.", procedure: "Piece placed at 3 orientations, robot drives at 50%, intake 1.5 s. 20 trials.", independentVariable: "roller spacing", metricName: "success rate", trials: 20, successes: 11, outcome: "fail", passCriteria: ">= 16 / 20", environment: "Workshop tile floor", observations: "Piece wedged between rollers on 6 trials; 3 trials missed entirely.", performedAt: daysAgo(17), createdBy: anim.id }).returning();
  const [t42] = await db.insert(tests).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Intake, iterationId: it18.id, title: "Intake pickup at 36 mm spacing", targetType: "revision", targetLabel: "CAD rev 23 (36 mm)", question: "Does 36 mm spacing reduce jams?", hypothesis: "4 mm more clearance removes the wedge condition.", procedure: "Identical to test at 32 mm. 20 trials.", independentVariable: "roller spacing", metricName: "success rate", trials: 20, successes: 17, outcome: "pass", passCriteria: ">= 16 / 20", environment: "Workshop tile floor", observations: "No wedging observed. 3 misses were orientation-related.", performedAt: daysAgo(11), createdBy: anim.id }).returning();
  const [d9] = await db.insert(decisions).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Intake, iterationId: it18.id, title: "Keep 36 mm roller spacing", disposition: "keep", decidedAt: daysAgo(9), authorUserId: anim.id, alternatives: ["Stay at 32 mm and add compliant wheels", "Try 40 mm spacing"] }).returning();
  await db.insert(relations).values([
    { teamId: team.id, fromType: "decision", fromId: d9.id, toType: "test", toId: t42.id, relationType: "SUPPORTS", origin: "student", createdBy: anim.id },
    { teamId: team.id, fromType: "decision", fromId: d9.id, toType: "test", toId: t41.id, relationType: "REFERENCES", origin: "student", createdBy: anim.id },
    { teamId: team.id, fromType: "test", fromId: t42.id, toType: "test", toId: t41.id, relationType: "SUPERSEDES", origin: "student", createdBy: anim.id },
    { teamId: team.id, fromType: "iteration", fromId: it18.id, toType: "iteration", toId: chain.id, relationType: "RELATED_TO", origin: "suggestion", status: "suggested" },
  ]);
  await db.insert(annotations).values([
    { teamId: team.id, entityType: "iteration", entityId: it18.id, field: "problem", body: "Game piece occasionally jams between the intake rollers during pickup.", authorUserId: anim.id },
    { teamId: team.id, entityType: "iteration", entityId: it18.id, field: "change", body: "Increased roller spacing from 32 mm to 36 mm and reprinted the side plates.", authorUserId: anim.id },
    { teamId: team.id, entityType: "iteration", entityId: it18.id, field: "rationale", body: "At 32 mm the object occasionally became wedged between the rollers. We hypothesised 4 mm more clearance would stop the wedge without losing grip.", authorUserId: anim.id },
    { teamId: team.id, entityType: "decision", entityId: d9.id, field: "rationale", body: "36 mm scored 17/20 against 11/20 at 32 mm with the same procedure. Wedging disappeared. Remaining misses are orientation-related and belong to a different problem.", authorUserId: anim.id },
    { teamId: team.id, entityType: "decision", entityId: d9.id, field: "next_step", body: "Investigate orientation misses with a guide plate.", authorUserId: anim.id },
    { teamId: team.id, entityType: "test", entityId: t41.id, field: "note", body: "Video of trial 7 shows the piece rotating and locking between rollers.", authorUserId: dana.id },
  ]);

  // Iteration 2: competition issue → guide plate (open)
  const [it22] = await db.insert(iterations).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Intake, title: "Intake guide plate after Competition 2 misses", state: "testing", problemOrGoal: "At Competition 2 the intake missed pieces presented on their side.", openedAt: daysAgo(5), createdBy: dana.id }).returning();
  await db.insert(annotations).values({ teamId: team.id, entityType: "iteration", entityId: it22.id, field: "problem", body: "In match 14 we missed 4 of 6 side-presented pieces. Drivers reported no jams — the intake simply did not engage.", authorUserId: dana.id });
  const [it30] = await db.insert(iterations).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Autonomous, title: "Autonomous tuning — park path", state: "open", problemOrGoal: "Auto park path overshoots by ~8 cm on fresh tiles.", openedAt: daysAgo(3), createdBy: lead.id }).returning();
  const [it31] = await db.insert(iterations).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Lift, title: "Lift prototype — 2-stage vs 3-stage", state: "deciding", problemOrGoal: "Need 90 cm reach within 45 cm starting height.", openedAt: daysAgo(12), createdBy: lead.id }).returning();
  const [tLift] = await db.insert(tests).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Lift, iterationId: it31.id, title: "Lift extension time (2-stage)", targetType: "prototype", targetLabel: "2-stage cascade", metricName: "extension time", units: "s", value: "1.8", outcome: "inconclusive", procedure: "Full extension from stowed, 5 runs, stopwatch.", observations: "Consistent but slower than target 1.5 s.", performedAt: daysAgo(6), createdBy: lead.id }).returning();
  await db.insert(tests).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Autonomous, iterationId: it30.id, title: "Park path overshoot (kP=0.8)", targetType: "commit", targetLabel: "a1b2c3d", metricName: "overshoot", units: "cm", value: "8.2", outcome: "fail", passCriteria: "< 3 cm", performedAt: daysAgo(2), createdBy: lead.id });
  await db.insert(decisions).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Drivetrain, title: "Mecanum over tank drive", disposition: "keep", status: "closed", decidedAt: daysAgo(40), authorUserId: lead.id, alternatives: ["6-wheel tank", "Swerve"] });
  const [dNoEvidence] = await db.insert(decisions).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Vision, title: "Use AprilTags for alignment", disposition: "keep", status: "closed", decidedAt: daysAgo(15), authorUserId: dana.id }).returning();
  await db.insert(annotations).values({ teamId: team.id, entityType: "decision", entityId: dNoEvidence.id, field: "rationale", body: "Tag detection was more stable than colour blobs in our lighting tests (not yet recorded as a structured test).", authorUserId: dana.id });
  await db.insert(decisions).values({ teamId: team.id, projectId: proj.id, subsystemId: sub.Lift, iterationId: it31.id, title: "Lift stage count", disposition: "unknown", status: "open", decidedAt: daysAgo(1), authorUserId: lead.id, alternatives: ["2-stage", "3-stage"] });

  // Source events: commits, CAD revisions, photos, chat
  const ev = (o: { provider: string; eventType: string; title: string; occurredAt: Date; actor?: string; actorUserId?: string | null; subsystemId?: string | null; iterationId?: string | null; meta?: Record<string, unknown>; summary?: string | null; status?: string }) => ({
    teamId: team.id,
    seasonId: s2026.id,
    projectId: proj.id,
    subsystemId: o.subsystemId ?? null,
    iterationId: o.iterationId ?? null,
    provider: o.provider,
    providerEventId: `${o.provider}-${hash(o.title + o.occurredAt.toISOString()).slice(0, 12)}`,
    eventType: o.eventType,
    actorExternalId: o.actor ?? null,
    actorUserId: o.actorUserId ?? null,
    title: o.title,
    summary: o.summary ?? null,
    occurredAt: o.occurredAt,
    rawMetadata: o.meta ?? {},
    contentHash: hash(o.title),
    status: o.status ?? (o.iterationId ? "linked" : "inbox"),
  });
  const commits = [
    ["feat: intake state machine", 6, anim, sub.Intake, it22.id],
    ["fix: intake PID overshoot", 2, anim, sub.Intake, null],
    ["refactor: split auto paths into opmodes", 3, lead, sub.Autonomous, it30.id],
    ["tune: park path kP 0.8 -> 0.6", 1, lead, sub.Autonomous, null],
    ["feat: apriltag alignment helper", 14, dana, sub.Vision, null],
    ["chore: telemetry for lift encoder", 5, lead, sub.Lift, it31.id],
    ["fix: lift limit switch debounce", 4, lead, sub.Lift, it31.id],
    ["feat: roller spacing constant 36mm", 10, anim, sub.Intake, it18.id],
    ["test: intake bench harness", 16, anim, sub.Intake, it18.id],
    ["docs: driver controls", 7, dana, null, null],
    ["fix: mecanum strafe drift", 8, lead, sub.Drivetrain, null],
    ["feat: auto park v2", 2, lead, sub.Autonomous, null],
    ["fix: vision thread crash", 1, dana, sub.Vision, null],
  ] as const;
  const events = commits.map(([title, days, u, s, it], i) => ev({ provider: "github", eventType: "commit", title, occurredAt: daysAgo(days, 14 + (i % 5)), actor: u.displayName.split(" ")[0].toLowerCase(), actorUserId: u.id, subsystemId: s, iterationId: it, meta: { repository: "team/orion-robot", sha: hash(title).slice(0, 40), branch: "main", changedFiles: 1 + (i % 4) } }));
  events.push(
    ev({ provider: "onshape", eventType: "cad_revision", title: "Intake side plate — roller spacing 36 mm (rev 23)", occurredAt: daysAgo(12, 18), actor: "anim", actorUserId: anim.id, subsystemId: sub.Intake, iterationId: it18.id, meta: { documentId: "d-orion", elementId: "e-intake-plate", microversion: "mv23", revision: 23 } }),
    ev({ provider: "onshape", eventType: "cad_revision", title: "Intake side plate — 32 mm (rev 21)", occurredAt: daysAgo(19, 17), actor: "anim", actorUserId: anim.id, subsystemId: sub.Intake, iterationId: it18.id, meta: { documentId: "d-orion", elementId: "e-intake-plate", microversion: "mv21", revision: 21 } }),
    ev({ provider: "onshape", eventType: "cad_revision", title: "Intake guide plate concept (rev 27)", occurredAt: daysAgo(4, 19), actor: "dana", actorUserId: dana.id, subsystemId: sub.Intake, meta: { documentId: "d-orion", elementId: "e-intake-guide", microversion: "mv27", revision: 27 } }),
    ev({ provider: "onshape", eventType: "cad_revision", title: "Lift 3-stage cascade layout (rev 12)", occurredAt: daysAgo(2, 20), actor: "aruzhan", actorUserId: lead.id, subsystemId: sub.Lift, meta: { documentId: "d-orion", elementId: "e-lift", microversion: "mv12", revision: 12 } }),
    ev({ provider: "onshape", eventType: "cad_revision", title: "Drivetrain belly pan lightening", occurredAt: daysAgo(6, 15), actor: "aruzhan", actorUserId: lead.id, subsystemId: sub.Drivetrain, meta: { documentId: "d-orion", elementId: "e-chassis", microversion: "mv40" } }),
    ev({ provider: "capture", eventType: "photo", title: "Piece wedged between rollers at 32 mm", occurredAt: daysAgo(17, 16), actorUserId: dana.id, subsystemId: sub.Intake, iterationId: it18.id, summary: "Trial 7 — piece rotated and locked.", meta: { capturedVia: "quick_capture", placeholder: true } }),
    ev({ provider: "capture", eventType: "photo", title: "36 mm side plates installed", occurredAt: daysAgo(12, 17), actorUserId: anim.id, subsystemId: sub.Intake, iterationId: it18.id, meta: { capturedVia: "quick_capture", placeholder: true } }),
    ev({ provider: "capture", eventType: "photo", title: "Guide plate cardboard mockup", occurredAt: daysAgo(4, 16), actorUserId: dana.id, subsystemId: sub.Intake, iterationId: it22.id, meta: { capturedVia: "quick_capture", placeholder: true } }),
    ev({ provider: "capture", eventType: "photo", title: "Lift 2-stage on the bench", occurredAt: daysAgo(6, 13), actorUserId: lead.id, subsystemId: sub.Lift, iterationId: it31.id, meta: { capturedVia: "quick_capture", placeholder: true } }),
    ev({ provider: "capture", eventType: "photo", title: "Auto park overshoot marks on tile", occurredAt: daysAgo(2, 18), actorUserId: lead.id, subsystemId: sub.Autonomous, meta: { capturedVia: "quick_capture", placeholder: true } }),
    ev({ provider: "capture", eventType: "problem", title: "Intake belt slipping after 10 minutes of driving", occurredAt: daysAgo(1, 19), actorUserId: dana.id, subsystemId: sub.Intake, summary: "Belt warms up and loses tension; observed twice in practice.", meta: { severity: "medium", capturedVia: "quick_capture" } }),
    ev({ provider: "telegram", eventType: "message", title: "#test #intake 36 mm spacing 17/20 success", occurredAt: daysAgo(11, 17), actor: "anim_k", actorUserId: anim.id, subsystemId: sub.Intake, iterationId: it18.id, meta: { chat: "orion-workshop", tags: ["test", "intake"], ratio: { successes: 17, trials: 20 } } }),
    ev({ provider: "telegram", eventType: "message", title: "#problem lift string frayed on stage 2 pulley", occurredAt: daysAgo(3, 21), actor: "dana_t", actorUserId: dana.id, meta: { chat: "orion-workshop", tags: ["problem"] } }),
  );
  const inserted = await db.insert(sourceEvents).values(events).returning();
  for (const e of inserted) {
    if (e.iterationId) await db.insert(relations).values({ teamId: team.id, fromType: "source_event", fromId: e.id, toType: "iteration", toId: e.iterationId, relationType: "SUPPORTS", origin: "student", createdBy: e.actorUserId }).onConflictDoNothing();
  }
  const rev23 = inserted.find((e) => e.title.includes("rev 23"));
  if (rev23) {
    await db.insert(relations).values([
      { teamId: team.id, fromType: "decision", fromId: d9.id, toType: "source_event", toId: rev23.id, relationType: "LEADS_TO", origin: "student", createdBy: anim.id },
      { teamId: team.id, fromType: "test", fromId: t42.id, toType: "source_event", toId: rev23.id, relationType: "TESTS", origin: "student", createdBy: anim.id },
    ]).onConflictDoNothing();
  }
  void tLift;
  console.log("Seeded demo data. Sign in: lead@trace.demo / demo1234 (also anim@, dana@, coach@, other@trace.demo)");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
