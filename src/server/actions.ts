"use server";

import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/db";
import {
  annotations,
  artifacts,
  auditEvents,
  competitionProfiles,
  decisions,
  exports as exportsTable,
  iterations,
  notifications,
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
  teamInvites,
  teamMemberships,
  teams,
  tests,
  users,
} from "@/db/schema";
import {
  AuthorizationError,
  assertRole,
  createSession,
  DUMMY_PASSWORD_HASH,
  destroySession,
  getCurrentUser,
  hashPassword,
  policyActorRole,
  requireTeam,
  requireUser,
  setCurrentTeamCookie,
  verifyPassword,
} from "./auth";
import { audit, enqueueJob, notify, track } from "./audit";
import { gate, logAiAction } from "./policy";
import { encryptSecret, newStorageKey, sha256, storage } from "./storage";
import { explainWhy, getActiveSeasonAndProject, seasonHandoff, similarHistory, testResultLabel, type EntityType } from "./evidence";
import { getAiProvider } from "@/modules/ai/provider";
import { isLocale } from "@/lib/i18n";
import { isPolicyAction, isPolicyDecision, POLICY_ACTIONS, type ActionMatrix } from "@/modules/policies/engine";
import { brand } from "@/lib/brand";
import { parseCsv } from "@/lib/csv";
import { canInviteRole, developmentBillingEnabled, devSimulatorEnabled, entityTypeSchema, safeInternalPath } from "@/lib/security";
import { captureSchema, persistCaptureInternal } from "./capture";

export type ActionState = { ok: boolean; error?: string; message?: string; id?: string } | null;

const uuid = z.string().uuid();
const str = (max = 2000) => z.string().trim().max(max);
const optStr = (max = 2000) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

function fd(formData: FormData) {
  const o: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") o[k] = v;
  return o;
}

function fail(error: string): ActionState {
  return { ok: false, error };
}

function safeError(err: unknown): ActionState {
  if (err instanceof AuthorizationError) return fail(err.message);
  if (err instanceof z.ZodError) return fail(err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  if (err && typeof err === "object" && "digest" in err) throw err; // Next redirect
  console.error(JSON.stringify({ level: "error", msg: "action_failed", err: String(err) }));
  return fail("Something went wrong. Your data was not lost — please retry.");
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const credentials = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(8).max(200) });

export async function signUp(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = credentials.extend({ displayName: str(80).min(1), locale: z.string().optional() }).parse(fd(formData));
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing[0]) return fail("An account with this email already exists.");
    const [user] = await db
      .insert(users)
      .values({ email: input.email, passwordHash: await hashPassword(input.password), displayName: input.displayName, locale: isLocale(input.locale) ? input.locale : "en" })
      .returning();
    await createSession(user.id);
    await track("user.signed_up", { userId: user.id });
  } catch (err) {
    return safeError(err);
  }
  const invite = formData.get("invite");
  redirect(typeof invite === "string" && invite ? `/join/${encodeURIComponent(invite)}` : "/onboarding");
}

export async function signIn(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const input = credentials.parse(fd(formData));
    const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
    const passwordValid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordValid) return fail("Invalid email or password.");
    await createSession(user.id);
  } catch (err) {
    return safeError(err);
  }
  const next = formData.get("next");
  redirect(safeInternalPath(next));
}

export async function signOut() {
  await destroySession();
  redirect("/");
}

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale");
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set("pt_lang", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const user = await getCurrentUser();
  if (user) await db.update(users).set({ locale }).where(eq(users.id, user.id));
  revalidatePath("/", "layout");
}

export async function switchTeam(formData: FormData) {
  const user = await requireUser();
  const teamId = uuid.parse(formData.get("teamId"));
  const m = await db.select({ id: teamMemberships.id }).from(teamMemberships).where(and(eq(teamMemberships.teamId, teamId), eq(teamMemberships.userId, user.id), eq(teamMemberships.status, "active"))).limit(1);
  if (!m[0]) throw new AuthorizationError();
  await setCurrentTeamCookie(teamId);
  revalidatePath("/app", "layout");
  redirect("/app");
}

// ---------------------------------------------------------------------------
// Onboarding: create team / join team
// ---------------------------------------------------------------------------
export async function createTeam(_: ActionState, formData: FormData): Promise<ActionState> {
  let teamId = "";
  try {
    const user = await requireUser();
    const input = z
      .object({
        orgMode: z.enum(["independent", "organization"]),
        orgName: optStr(120),
        teamName: str(120).min(1),
        teamNumber: optStr(20),
        program: z.enum(["FTC", "VEX", "FRC", "ISEF", "OTHER"]),
        seasonName: str(60).min(1),
        seasonYear: z.coerce.number().int().min(2000).max(2100),
        timezone: str(60).min(1),
        locale: z.string(),
        projectName: str(120).min(1),
        subsystems: str(500),
        profileKey: str(40),
      })
      .parse(fd(formData));

    const profileRows = await db.select().from(competitionProfiles).where(eq(competitionProfiles.key, input.profileKey)).limit(1);
    const profile = profileRows[0] ?? null;

    let organizationId: string | null = null;
    if (input.orgMode === "organization" && input.orgName) {
      const [org] = await db.insert(organizations).values({ name: input.orgName }).returning();
      organizationId = org.id;
      await db.insert(organizationMemberships).values({ organizationId: org.id, userId: user.id, role: "admin" });
      await db.insert(subscriptions).values({ organizationId: org.id, plan: "free", status: "active" });
      await audit({ organizationId: org.id, actorUserId: user.id, action: "organization.created", entityType: "organization", entityId: org.id });
    }
    const [team] = await db
      .insert(teams)
      .values({
        organizationId,
        name: input.teamName,
        number: input.teamNumber,
        program: input.program,
        timezone: input.timezone,
        defaultLocale: isLocale(input.locale) ? input.locale : "en",
        competitionProfileId: profile?.id ?? null,
        studentOwnedMode: true,
      })
      .returning();
    teamId = team.id;
    await db.insert(teamMemberships).values({ teamId: team.id, userId: user.id, role: "student_lead" });
    const [season] = await db.insert(seasons).values({ teamId: team.id, name: input.seasonName, year: input.seasonYear, isActive: true }).returning();
    const [project] = await db.insert(projects).values({ teamId: team.id, seasonId: season.id, name: input.projectName }).returning();
    const subs = input.subsystems.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
    if (subs.length) await db.insert(subsystems).values(subs.map((name) => ({ teamId: team.id, projectId: project.id, name })));
    await setCurrentTeamCookie(team.id);
    await audit({ teamId: team.id, organizationId, actorUserId: user.id, action: "team.created", entityType: "team", entityId: team.id });
    await track("team.created", { teamId: team.id, userId: user.id, props: { program: input.program } });
    await track("season.created", { teamId: team.id, userId: user.id });
    await track("project.created", { teamId: team.id, userId: user.id });
    if (profile) await track("competition.profile_selected", { teamId: team.id, props: { profile: profile.key } });
  } catch (err) {
    return safeError(err);
  }
  redirect(`/app?welcome=1&team=${teamId}`);
}

export async function createInvite(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin"]);
  const role = z.enum(["student", "student_lead", "coach"]).parse(formData.get("role"));
  if (!canInviteRole(policyActorRole(ctx), role)) throw new AuthorizationError("You cannot invite this role.");
  const maxUses = z.coerce.number().int().min(1).max(50).parse(formData.get("maxUses") ?? 1);
  const code = randomBytes(9).toString("base64url");
  await db.insert(teamInvites).values({ teamId: ctx.team.id, code, role, maxUses, expiresAt: new Date(Date.now() + 7 * 86400_000), createdBy: ctx.user.id });
  await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "invite.created", metadata: { role, maxUses } });
  revalidatePath("/app/members");
}

export async function revokeInvite(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin"]);
  const id = uuid.parse(formData.get("id"));
  await db.update(teamInvites).set({ revokedAt: new Date() }).where(and(eq(teamInvites.id, id), eq(teamInvites.teamId, ctx.team.id)));
  await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "invite.revoked", entityId: id });
  revalidatePath("/app/members");
}

export async function joinTeam(_: ActionState, formData: FormData): Promise<ActionState> {
  let joinedTeamId = "";
  try {
    const user = await requireUser();
    const code = str(64).min(4).parse(formData.get("code"));
    const invite = await db.transaction(async (tx) => {
      const [consumed] = await tx
        .update(teamInvites)
        .set({ uses: sql`${teamInvites.uses} + 1` })
        .where(and(eq(teamInvites.code, code), isNull(teamInvites.revokedAt), gt(teamInvites.expiresAt, new Date()), sql`${teamInvites.uses} < ${teamInvites.maxUses}`))
        .returning();
      if (!consumed) return null;

      await tx
        .insert(teamMemberships)
        .values({ teamId: consumed.teamId, userId: user.id, role: consumed.role })
        .onConflictDoUpdate({
          target: [teamMemberships.teamId, teamMemberships.userId],
          set: { role: consumed.role, status: "active", leftAt: null },
        });
      await tx.insert(auditEvents).values({
        teamId: consumed.teamId,
        actorUserId: user.id,
        action: "member.joined",
        metadata: { role: consumed.role, inviteId: consumed.id },
      });
      return consumed;
    });
    if (!invite) return fail("This invite is invalid, expired, or already used.");
    joinedTeamId = invite.teamId;
    await setCurrentTeamCookie(invite.teamId);
  } catch (err) {
    return safeError(err);
  }
  redirect(joinedTeamId ? "/app" : "/join");
}

// ---------------------------------------------------------------------------
// Annotations (versioned, student-owned)
// ---------------------------------------------------------------------------
async function writeAnnotation(params: { teamId: string; entityType: string; entityId: string; field: string; body: string; authorUserId: string; sourceMethod?: string; provenance?: string }) {
  const prev = await db
    .select({ id: annotations.id })
    .from(annotations)
    .where(and(eq(annotations.entityType, params.entityType), eq(annotations.entityId, params.entityId), eq(annotations.field, params.field)))
    .orderBy(desc(annotations.createdAt))
    .limit(1);
  const [row] = await db
    .insert(annotations)
    .values({
      teamId: params.teamId,
      entityType: params.entityType,
      entityId: params.entityId,
      field: params.field,
      body: params.body,
      authorUserId: params.authorUserId,
      sourceMethod: params.sourceMethod ?? "typed",
      provenance: params.provenance ?? "student",
      supersedesId: prev[0]?.id ?? null,
    })
    .returning();
  return row;
}

export async function addAnnotation(formData: FormData) {
  const ctx = await requireTeam();
  const input = z
    .object({ entityType: z.enum(["source_event", "iteration", "test", "decision", "subsystem", "artifact"]), entityId: uuid, field: str(40).min(1), body: str(5000).min(1), returnTo: str(200) })
    .parse(fd(formData));
  if (!ctx.canAuthorStudentContent) {
    // Coaches may leave a coach note but can never author/overwrite student rationale fields.
    if (input.field !== "coach_note") throw new AuthorizationError("Coaches cannot author student engineering content. Use a coach note instead.");
  }
  await assertEntityInTeam(ctx.team.id, input.entityType, input.entityId);
  await writeAnnotation({ teamId: ctx.team.id, ...input, authorUserId: ctx.user.id, provenance: input.field === "coach_note" ? "system" : "student" });
  revalidatePath(safeInternalPath(input.returnTo, "/app"));
}

async function assertEntityInTeam(teamId: string, rawType: string, id: string) {
  const type = entityTypeSchema.parse(rawType);
  const table =
    type === "iteration" ? iterations
      : type === "test" ? tests
        : type === "decision" ? decisions
          : type === "subsystem" ? subsystems
            : type === "artifact" ? artifacts
              : type === "project" ? projects
                : sourceEvents;
  const rows = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.teamId, teamId))).limit(1);
  if (!rows[0]) throw new AuthorizationError("Entity not found in this team.");
}

// ---------------------------------------------------------------------------
// Capture (also used by the offline sync endpoint)
// ---------------------------------------------------------------------------
export async function createCapture(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireTeam();
    if (!ctx.canAuthorStudentContent) return fail("Coaches cannot create student captures. Ask a student to record this.");
    const input = captureSchema.parse(fd(formData));
    const file = formData.get("photo");
    const result = await persistCaptureInternal(ctx.team.id, ctx.user.id, input, file instanceof File && file.size > 0 ? file : null);
    await track(result.deduplicated ? "capture.deduplicated" : "capture.created", { teamId: ctx.team.id, userId: ctx.user.id, props: { kind: input.kind } });
    revalidatePath("/app");
    return { ok: true, message: result.deduplicated ? "Already saved." : "Saved.", id: result.eventId };
  } catch (err) {
    return safeError(err);
  }
}

// ---------------------------------------------------------------------------
// Inbox triage
// ---------------------------------------------------------------------------
export async function triageEvents(formData: FormData) {
  const ctx = await requireTeam();
  const input = z
    .object({ action: z.enum(["link", "create_iteration", "ignore", "restore", "sensitive", "subsystem"]), iterationId: z.string().optional(), subsystemId: z.string().optional(), title: z.string().optional() })
    .parse(fd(formData));
  const ids = formData.getAll("eventId").map((v) => uuid.parse(v));
  if (ids.length === 0) return;
  const owned = await db.select({ id: sourceEvents.id, subsystemId: sourceEvents.subsystemId }).from(sourceEvents).where(and(eq(sourceEvents.teamId, ctx.team.id), inArray(sourceEvents.id, ids)));
  const ownedIds = owned.map((o) => o.id);
  if (ownedIds.length !== ids.length) throw new AuthorizationError();

  if (input.action === "ignore") await db.update(sourceEvents).set({ status: "ignored" }).where(inArray(sourceEvents.id, ownedIds));
  if (input.action === "restore") await db.update(sourceEvents).set({ status: "inbox" }).where(inArray(sourceEvents.id, ownedIds));
  if (input.action === "sensitive") {
    assertRole(ctx, ["student_lead", "coach", "org_admin"]);
    await db.update(sourceEvents).set({ visibility: "sensitive" }).where(inArray(sourceEvents.id, ownedIds));
  }
  if (input.action === "subsystem" && input.subsystemId) {
    await assertEntityInTeam(ctx.team.id, "subsystem", uuid.parse(input.subsystemId));
    await db.update(sourceEvents).set({ subsystemId: input.subsystemId }).where(inArray(sourceEvents.id, ownedIds));
  }
  let iterationId = input.iterationId && input.iterationId !== "" ? uuid.parse(input.iterationId) : null;
  if (input.action === "create_iteration") {
    const { project } = await getActiveSeasonAndProject(ctx.team.id);
    if (!project) throw new Error("No active project");
    const subsystemId = input.subsystemId ? uuid.parse(input.subsystemId) : (owned.find((o) => o.subsystemId)?.subsystemId ?? null);
    const [it] = await db.insert(iterations).values({ teamId: ctx.team.id, projectId: project.id, subsystemId, title: input.title?.trim() || "New iteration", createdBy: ctx.user.id }).returning();
    iterationId = it.id;
    await track("iteration.created", { teamId: ctx.team.id, userId: ctx.user.id, props: { from: "inbox" } });
  }
  if (iterationId && (input.action === "link" || input.action === "create_iteration")) {
    await assertEntityInTeam(ctx.team.id, "iteration", iterationId);
    await db.update(sourceEvents).set({ status: "linked", iterationId }).where(inArray(sourceEvents.id, ownedIds));
    for (const id of ownedIds) {
      await db.insert(relations).values({ teamId: ctx.team.id, fromType: "source_event", fromId: id, toType: "iteration", toId: iterationId, relationType: "SUPPORTS", origin: "student", createdBy: ctx.user.id }).onConflictDoNothing();
    }
    await track("inbox.event_linked", { teamId: ctx.team.id, userId: ctx.user.id, props: { n: ownedIds.length } });
  }
  if (input.action === "ignore") await track("inbox.event_ignored", { teamId: ctx.team.id, userId: ctx.user.id, props: { n: ownedIds.length } });
  revalidatePath("/app/inbox");
  if (input.action === "create_iteration" && iterationId) redirect(`/app/iterations/${iterationId}`);
}

// ---------------------------------------------------------------------------
// Iterations / relations
// ---------------------------------------------------------------------------
export async function createIteration(_: ActionState, formData: FormData): Promise<ActionState> {
  let id = "";
  try {
    const ctx = await requireTeam();
    if (!ctx.canAuthorStudentContent) return fail("Coaches cannot open student iterations.");
    const input = z.object({ title: str(160).min(1), subsystemId: z.string().optional(), problemOrGoal: optStr(3000) }).parse(fd(formData));
    const { project, season } = await getActiveSeasonAndProject(ctx.team.id);
    if (!project) return fail("No active project.");
    const subsystemId = input.subsystemId ? uuid.parse(input.subsystemId) : null;
    if (subsystemId) await assertEntityInTeam(ctx.team.id, "subsystem", subsystemId);
    const [it] = await db.insert(iterations).values({ teamId: ctx.team.id, projectId: project.id, subsystemId, title: input.title, problemOrGoal: input.problemOrGoal, createdBy: ctx.user.id }).returning();
    id = it.id;
    if (input.problemOrGoal) await writeAnnotation({ teamId: ctx.team.id, entityType: "iteration", entityId: it.id, field: "problem", body: input.problemOrGoal, authorUserId: ctx.user.id });
    const similar = await similarHistory(ctx.team.id, input.title, season?.id);
    for (const s of similar) {
      await db.insert(relations).values({ teamId: ctx.team.id, fromType: "iteration", fromId: it.id, toType: "iteration", toId: s.it.id, relationType: "RELATED_TO", origin: "suggestion", status: "suggested", createdBy: null }).onConflictDoNothing();
    }
    await track("iteration.created", { teamId: ctx.team.id, userId: ctx.user.id });
  } catch (err) {
    return safeError(err);
  }
  redirect(`/app/iterations/${id}`);
}

export async function updateIteration(formData: FormData) {
  const ctx = await requireTeam();
  const input = z
    .object({ id: uuid, state: z.enum(["open", "testing", "deciding", "closed"]).optional(), outcome: z.enum(["kept", "reverted", "rejected", "deferred", ""]).optional(), changeSummary: optStr(3000), nextStep: optStr(3000), why: optStr(5000) })
    .parse(fd(formData));
  await assertEntityInTeam(ctx.team.id, "iteration", input.id);
  if (input.changeSummary || input.nextStep || input.why) {
    if (!ctx.canAuthorStudentContent) throw new AuthorizationError("Coaches cannot author student content.");
    if (input.changeSummary) await writeAnnotation({ teamId: ctx.team.id, entityType: "iteration", entityId: input.id, field: "change", body: input.changeSummary, authorUserId: ctx.user.id });
    if (input.nextStep) await writeAnnotation({ teamId: ctx.team.id, entityType: "iteration", entityId: input.id, field: "next_step", body: input.nextStep, authorUserId: ctx.user.id });
    if (input.why) await writeAnnotation({ teamId: ctx.team.id, entityType: "iteration", entityId: input.id, field: "rationale", body: input.why, authorUserId: ctx.user.id });
  }
  const patch: Partial<typeof iterations.$inferInsert> = {};
  if (input.changeSummary) patch.changeSummary = input.changeSummary;
  if (input.state) {
    patch.state = input.state;
    if (input.state === "closed") {
      patch.closedAt = new Date();
      patch.outcome = input.outcome || null;
      await track("iteration.closed", { teamId: ctx.team.id, userId: ctx.user.id });
    }
  }
  if (Object.keys(patch).length) await db.update(iterations).set(patch).where(eq(iterations.id, input.id));
  revalidatePath(`/app/iterations/${input.id}`);
}

export async function addRelation(formData: FormData) {
  const ctx = await requireTeam();
  const input = z
    .object({ fromType: entityTypeSchema, fromId: uuid, toType: entityTypeSchema, toId: uuid, relationType: z.enum(["RESPONDS_TO", "IMPLEMENTS", "MODIFIES", "TESTS", "SUPPORTS", "CONTRADICTS", "SUPERSEDES", "DERIVED_FROM", "CONTRIBUTED_BY", "LEADS_TO", "REFERENCES", "RELATED_TO"]), returnTo: str(200) })
    .parse(fd(formData));
  await assertEntityInTeam(ctx.team.id, input.fromType, input.fromId);
  await assertEntityInTeam(ctx.team.id, input.toType, input.toId);
  await db.insert(relations).values({ teamId: ctx.team.id, fromType: input.fromType, fromId: input.fromId, toType: input.toType, toId: input.toId, relationType: input.relationType, origin: "student", status: "accepted", createdBy: ctx.user.id }).onConflictDoUpdate({ target: [relations.fromType, relations.fromId, relations.toType, relations.toId, relations.relationType], set: { status: "accepted", origin: "student" } });
  if (input.fromType === "test" && input.toType === "iteration") await db.update(tests).set({ iterationId: input.toId }).where(eq(tests.id, input.fromId));
  if (input.fromType === "decision" && input.toType === "test") await track("decision.linked_to_test", { teamId: ctx.team.id, userId: ctx.user.id });
  if (input.fromType === "test") await track("test.linked", { teamId: ctx.team.id, userId: ctx.user.id });
  revalidatePath(safeInternalPath(input.returnTo, "/app"));
}

export async function resolveSuggestion(formData: FormData) {
  const ctx = await requireTeam();
  const input = z.object({ id: uuid, status: z.enum(["accepted", "rejected"]), returnTo: str(200) }).parse(fd(formData));
  await db.update(relations).set({ status: input.status, createdBy: ctx.user.id }).where(and(eq(relations.id, input.id), eq(relations.teamId, ctx.team.id)));
  revalidatePath(input.returnTo);
}

export async function createSubsystem(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin", "student"]);
  const input = z.object({ name: str(80).min(1), parentId: z.string().optional() }).parse(fd(formData));
  const { project } = await getActiveSeasonAndProject(ctx.team.id);
  if (!project) return;
  const parentId = input.parentId ? uuid.parse(input.parentId) : null;
  if (parentId) {
    const [parent] = await db
      .select({ id: subsystems.id })
      .from(subsystems)
      .where(and(eq(subsystems.id, parentId), eq(subsystems.teamId, ctx.team.id), eq(subsystems.projectId, project.id)))
      .limit(1);
    if (!parent) throw new AuthorizationError("Parent subsystem is not in the active team project.");
  }
  await db.insert(subsystems).values({ teamId: ctx.team.id, projectId: project.id, name: input.name, parentId });
  revalidatePath("/app/timeline");
}

// ---------------------------------------------------------------------------
// Competition policy
// ---------------------------------------------------------------------------
export async function setCompetitionProfile(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin"]);
  const profileId = uuid.parse(formData.get("profileId"));
  const [p] = await db.select().from(competitionProfiles).where(eq(competitionProfiles.id, profileId)).limit(1);
  if (!p) throw new Error("Unknown profile");
  await db.update(teams).set({ competitionProfileId: profileId }).where(eq(teams.id, ctx.team.id));
  await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "competition.profile_selected", metadata: { profile: p.key } });
  await track("competition.profile_selected", { teamId: ctx.team.id, props: { profile: p.key } });
  revalidatePath("/app", "layout");
}

export async function toggleStudentOwnedMode(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin"]);
  const enabled = formData.get("enabled") === "true";
  await db.update(teams).set({ studentOwnedMode: enabled }).where(eq(teams.id, ctx.team.id));
  await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "team.student_owned_mode", metadata: { enabled } });
  revalidatePath("/app", "layout");
}

export async function createPolicyVersion(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireTeam();
    if (ctx.user.platformRole !== "platform_admin") throw new AuthorizationError("Only a platform administrator may publish global policy versions.");
    const input = z.object({ profileId: uuid, version: str(40).min(1), status: z.enum(["draft", "active", "needs_review"]), effectiveFrom: optStr(20), sourceUrls: optStr(2000), changelog: str(4000).min(1) }).parse(fd(formData));
    const matrix: ActionMatrix = {};
    for (const a of POLICY_ACTIONS) {
      const v = formData.get(`matrix.${a}`);
      if (isPolicyDecision(v)) matrix[a] = v;
    }
    if (Object.keys(matrix).length !== POLICY_ACTIONS.length) return fail("Every policy action must have an explicit decision.");
    await db.transaction(async (tx) => {
      if (input.status === "active") {
        await tx.update(policyVersions).set({ status: "superseded" }).where(and(eq(policyVersions.profileId, input.profileId), eq(policyVersions.status, "active")));
      }
      const [version] = await tx.insert(policyVersions).values({
        profileId: input.profileId,
        version: input.version,
        status: input.status,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
        reviewedAt: new Date(),
        reviewer: ctx.user.displayName,
        sourceUrls: (input.sourceUrls ?? "").split(/\s+/).filter(Boolean),
        changelog: input.changelog,
        actionMatrix: matrix,
        createdBy: ctx.user.id,
      }).returning({ id: policyVersions.id });
      await tx.insert(auditEvents).values({
        actorUserId: ctx.user.id,
        action: "policy.version_created",
        entityType: "policy_version",
        entityId: version.id,
        metadata: { profileId: input.profileId, version: input.version, status: input.status },
      });
    });
    revalidatePath("/app/competition");
    return { ok: true, message: `Policy version ${input.version} recorded.` };
  } catch (err) {
    return safeError(err);
  }
}

// ---------------------------------------------------------------------------
// AI (policy-gated, logged, never overwrites student content)
// ---------------------------------------------------------------------------
export async function askHistory(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireTeam();
    const question = str(500).min(3).parse(formData.get("question"));
    const g = await gate(ctx, "generate_ai_memory_answer");
    const retrieval = await gate(ctx, "retrieve_evidence");
    if (!retrieval.allowed) return fail(retrieval.reason);
    // Deterministic retrieval always runs (core feature). Generative phrasing only if policy allows AND provider enabled.
    const similar = await similarHistory(ctx.team.id, question);
    const bundles = [];
    for (const s of similar.slice(0, 3)) {
      const why = await explainWhy(ctx.team.id, "iteration", s.it.id);
      if (why) bundles.push({ season: s.season, why });
    }
    const lines: string[] = [];
    if (bundles.length === 0) lines.push("Not documented: no iteration, test or decision matches this question in the team's evidence.");
    for (const b of bundles) {
      lines.push(`Iteration "${b.why.title}" (${b.season}) — ${b.why.iteration?.state ?? ""}${b.why.iteration?.outcome ? " · " + b.why.iteration.outcome : ""}`);
      for (const t of b.why.tests) lines.push(`  Test: ${t.title} → ${testResultLabel(t)} [test:${t.id}]`);
      for (const d of b.why.decisions) lines.push(`  Decision: ${d.title} → ${d.disposition} [decision:${d.id}]`);
      for (const r of b.why.rationale) lines.push(`  Student wrote (${r.a.field}): "${r.a.body}" [annotation:${r.a.id}]`);
      if (b.why.comparison?.improvement != null) lines.push(`  System-computed: ${b.why.comparison.improvement > 0 ? "+" : ""}${b.why.comparison.improvement}% relative change between first and last quantitative test.`);
    }
    let output = lines.join("\n");
    let provider: string | null = "deterministic-retrieval";
    let model: string | null = null;
    const ai = getAiProvider();
    if (g.allowed && ai.enabled && bundles.length > 0) {
      const gen = await ai.generate({
        system: "You summarise ONLY the evidence provided. Never invent rationale, results or decisions. Quote student statements verbatim and label inference. Say 'not documented' when missing. Keep citations like [test:ID].",
        prompt: `Question: ${question}\n\nEvidence:\n${output}`,
      });
      if (gen.text) {
        output = gen.text;
        provider = gen.provider;
        model = gen.model;
      }
    }
    const logRow = await logAiAction({ ctx, action: "generate_ai_memory_answer", gate: g, referencedEntities: bundles.flatMap((b) => [{ type: "iteration", id: b.why.entityId }]), provider, model, prompt: question, output, disposition: g.allowed ? "pending" : "blocked" });
    await track("memory.history_opened", { teamId: ctx.team.id, userId: ctx.user.id });
    return { ok: true, id: logRow.id, message: output + (g.allowed ? "" : `\n\n[Policy: ${g.decision} — ${g.reason} Deterministic retrieval shown; no generated text.]`) };
  } catch (err) {
    return safeError(err);
  }
}

export async function requestAiTransform(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireTeam();
    const action = formData.get("action");
    if (!isPolicyAction(action)) return fail("Unknown action");
    const input = z.object({ entityType: str(20), entityId: z.string().uuid().optional().or(z.literal("")), text: str(5000).min(1) }).parse(fd(formData));
    const entityId = input.entityId || null;
    if (entityId) await assertEntityInTeam(ctx.team.id, input.entityType, entityId);
    const g = await gate(ctx, action);
    const refs = entityId ? [{ type: input.entityType, id: entityId }] : [];
    if (!g.allowed) {
      await logAiAction({ ctx, action, gate: g, referencedEntities: refs, disposition: "blocked" });
      await track("policy.action_blocked", { teamId: ctx.team.id, userId: ctx.user.id, props: { action, decision: g.decision } });
      return fail(`${g.decision}: ${g.reason}`);
    }
    const ai = getAiProvider();
    if (!ai.enabled) return fail("No AI provider is configured (AI_PROVIDER=disabled). The original text is untouched.");
    const gen = await ai.generate({ system: `Perform the action "${action}" on the student's text. Preserve meaning. Do not add facts.`, prompt: input.text });
    const row = await logAiAction({ ctx, action, gate: g, referencedEntities: refs, provider: gen.provider, model: gen.model, prompt: input.text, output: gen.text, disposition: "pending" });
    // Stored as a separate AI-provenance annotation; the student's original remains the authoritative version.
    if (entityId) await writeAnnotation({ teamId: ctx.team.id, entityType: input.entityType, entityId, field: `ai_suggestion:${action}`, body: gen.text, authorUserId: ctx.user.id, provenance: "ai", sourceMethod: "import" });
    return { ok: true, id: row.id, message: gen.text + (g.disclosureRequired ? "\n\n[Disclosure required: AI-assisted output, logged.]" : "") };
  } catch (err) {
    return safeError(err);
  }
}

export async function setAiDisposition(formData: FormData) {
  const ctx = await requireTeam();
  const input = z.object({ id: uuid, disposition: z.enum(["accepted", "rejected"]) }).parse(fd(formData));
  await db.execute(sql`update ai_action_logs set disposition = ${input.disposition} where id = ${input.id} and team_id = ${ctx.team.id}`);
  revalidatePath("/app/memory");
}

// ---------------------------------------------------------------------------
// Exports (provenance-preserving, policy-pinned, versioned)
// ---------------------------------------------------------------------------
export async function createExport(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireTeam();
    const type = z.enum(["vex_notebook", "ftc_portfolio", "season_handoff", "personal_contribution", "team_data"]).parse(formData.get("type"));
    if (type === "team_data") assertRole(ctx, ["student_lead", "coach", "org_admin"]);
    const g = await gate(ctx, type === "ftc_portfolio" ? "export_generated_content" : "export_deterministic_notebook");
    const includeGenerated = formData.get("includeGenerated") === "on";
    if (type === "ftc_portfolio" && includeGenerated && !g.allowed) {
      await db.insert(exportsTable).values({ teamId: ctx.team.id, type, createdBy: ctx.user.id, policyVersionId: g.policy.version?.id ?? null, policyDecision: g.decision, status: "blocked", error: g.reason, config: { includeGenerated } });
      await track("policy.action_blocked", { teamId: ctx.team.id, props: { action: "export_generated_content" } });
      return fail(`Export blocked: ${g.reason}`);
    }
    const { season } = await getActiveSeasonAndProject(ctx.team.id);
    const [{ maxV }] = await db.select({ maxV: sql<number>`coalesce(max(${exportsTable.version}), 0)` }).from(exportsTable).where(and(eq(exportsTable.teamId, ctx.team.id), eq(exportsTable.type, type)));
    const version = Number(maxV) + 1;
    const built = await buildExport(ctx.team.id, ctx.user.id, type, season?.id ?? null, includeGenerated && g.allowed);
    const key = `${ctx.team.id}/exports/${type}-v${version}.${built.ext}`;
    await storage.put(key, Buffer.from(built.body, "utf8"), built.contentType);
    const hash = sha256(built.body);
    const [row] = await db
      .insert(exportsTable)
      .values({ teamId: ctx.team.id, type, version, createdBy: ctx.user.id, forUserId: type === "personal_contribution" ? ctx.user.id : null, policyVersionId: g.policy.version?.id ?? null, policyDecision: g.decision, config: { includeGenerated: includeGenerated && g.allowed, seasonId: season?.id ?? null }, manifest: built.manifest, hash, storageKey: key, status: "ready" })
      .returning();
    await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "export.created", entityType: "export", entityId: row.id, metadata: { type, version } });
    await track("export.created", { teamId: ctx.team.id, userId: ctx.user.id, props: { type } });
    await notify({ userId: ctx.user.id, teamId: ctx.team.id, kind: "export_ready", title: `${type.replace(/_/g, " ")} v${version} is ready`, href: `/app/exports` });
    revalidatePath("/app/exports");
    return { ok: true, id: row.id, message: `Export v${version} created.` };
  } catch (err) {
    return safeError(err);
  }
}

async function buildExport(teamId: string, userId: string, type: string, seasonId: string | null, includeGenerated: boolean) {
  const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const manifest: Record<string, unknown> = { type, generatedAt: new Date().toISOString(), product: brand.productName, sourceEntityIds: [] as string[], studentContentIds: [] as string[], generatedContentIds: [] as string[] };
  const srcIds = manifest.sourceEntityIds as string[];
  const stuIds = manifest.studentContentIds as string[];
  const genIds = manifest.generatedContentIds as string[];

  if (type === "team_data") {
    const [evs, its, ts, ds, ann, rels] = await Promise.all([
      db.select().from(sourceEvents).where(eq(sourceEvents.teamId, teamId)),
      db.select().from(iterations).where(eq(iterations.teamId, teamId)),
      db.select().from(tests).where(eq(tests.teamId, teamId)),
      db.select().from(decisions).where(eq(decisions.teamId, teamId)),
      db.select().from(annotations).where(eq(annotations.teamId, teamId)),
      db.select().from(relations).where(eq(relations.teamId, teamId)),
    ]);
    srcIds.push(...evs.map((e) => e.id));
    stuIds.push(...ann.filter((a) => a.provenance === "student").map((a) => a.id));
    return { ext: "json", contentType: "application/json", manifest, body: JSON.stringify({ manifest, sourceEvents: evs, iterations: its, tests: ts, decisions: ds, annotations: ann, relations: rels }, null, 2) };
  }
  if (type === "personal_contribution") {
    const [evs, ts, ds, ann] = await Promise.all([
      db.select().from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), eq(sourceEvents.actorUserId, userId))),
      db.select().from(tests).where(and(eq(tests.teamId, teamId), eq(tests.createdBy, userId))),
      db.select().from(decisions).where(and(eq(decisions.teamId, teamId), eq(decisions.authorUserId, userId))),
      db.select().from(annotations).where(and(eq(annotations.teamId, teamId), eq(annotations.authorUserId, userId))),
    ]);
    srcIds.push(...evs.map((e) => e.id));
    stuIds.push(...ann.map((a) => a.id));
    return { ext: "json", contentType: "application/json", manifest, body: JSON.stringify({ manifest, sourceEvents: evs, tests: ts, decisions: ds, annotations: ann }, null, 2) };
  }
  // Deterministic chronological HTML notebook / portfolio / handoff
  const parts: string[] = [`<!doctype html><html><head><meta charset="utf-8"><title>${esc(type)} export</title><style>body{font:14px/1.5 system-ui;max-width:800px;margin:2rem auto;color:#101923}h1,h2,h3{font-weight:600}.prov{font:11px ui-monospace,monospace;color:#536170;border:1px solid #D7DEE5;padding:1px 6px;border-radius:3px}.entry{border-top:1px solid #D7DEE5;padding:1rem 0}.mono{font-family:ui-monospace,monospace}</style></head><body>`];
  parts.push(`<h1>${esc(type.replace(/_/g, " "))}</h1><p class="prov">Deterministic export · ${new Date().toISOString()} · ${brand.productName}</p>`);
  if (type === "season_handoff" && seasonId) {
    const sections = await seasonHandoff(teamId, seasonId);
    for (const s of sections) {
      parts.push(`<h2>${esc(s.subsystem.name)}</h2>`);
      parts.push(`<h3>Key decisions</h3><ul>${s.keyDecisions.map((d) => (srcIds.push(d.id), `<li>${esc(d.title)} — <span class="mono">${esc(d.disposition)}</span></li>`)).join("") || "<li>None documented</li>"}</ul>`);
      parts.push(`<h3>Failed approaches</h3><ul>${s.failed.map((i) => (srcIds.push(i.id), `<li>${esc(i.title)} — <span class="mono">${esc(i.outcome)}</span></li>`)).join("") || "<li>None documented</li>"}</ul>`);
      parts.push(`<h3>Important tests</h3><ul>${s.importantTests.map((t) => (srcIds.push(t.id), `<li>${esc(t.title)} — <span class="mono">${esc(testResultLabel(t))}</span></li>`)).join("") || "<li>None documented</li>"}</ul>`);
      parts.push(`<h3>Open problems</h3><ul>${s.open.map((i) => `<li>${esc(i.title)}</li>`).join("") || "<li>None</li>"}</ul>`);
    }
  } else {
    const evs = await db.select().from(sourceEvents).where(and(eq(sourceEvents.teamId, teamId), inArray(sourceEvents.status, ["linked", "inbox"]))).orderBy(sourceEvents.occurredAt).limit(500);
    const ts = await db.select().from(tests).where(eq(tests.teamId, teamId)).orderBy(tests.performedAt);
    const ds = await db.select().from(decisions).where(eq(decisions.teamId, teamId)).orderBy(decisions.decidedAt);
    const ann = await db.select().from(annotations).where(eq(annotations.teamId, teamId)).orderBy(desc(annotations.createdAt));
    const latest = new Map<string, (typeof ann)[number]>();
    for (const a of ann) {
      const k = `${a.entityType}:${a.entityId}:${a.field}`;
      if (!latest.has(k)) latest.set(k, a);
    }
    type Entry = { at: Date; html: string };
    const entries: Entry[] = [];
    const notesFor = (t: string, id: string) =>
      [...latest.values()]
        .filter((a) => a.entityType === t && a.entityId === id && (a.provenance === "student" || (includeGenerated && a.provenance === "ai")))
        .map((a) => ((a.provenance === "student" ? stuIds : genIds).push(a.id), `<p><span class="prov">${a.provenance === "ai" ? "AI-generated · disclosed" : "student-authored"} · ${esc(a.field)}</span><br>${esc(a.body)}</p>`))
        .join("");
    for (const e of evs) {
      srcIds.push(e.id);
      entries.push({ at: e.occurredAt, html: `<div class="entry"><span class="prov">${esc(e.provider)} · ${esc(e.eventType)} · <span class="mono">${e.occurredAt.toISOString()}</span></span><h3>${esc(e.title)}</h3>${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${notesFor("source_event", e.id)}</div>` });
    }
    for (const t of ts) {
      srcIds.push(t.id);
      entries.push({ at: t.performedAt, html: `<div class="entry"><span class="prov">test · <span class="mono">${t.performedAt.toISOString()}</span></span><h3>${esc(t.title)}</h3>${t.procedure ? `<p><b>Procedure:</b> ${esc(t.procedure)}</p>` : ""}<p><b>Result:</b> <span class="mono">${esc(testResultLabel(t))}</span> · ${esc(t.outcome)}</p>${t.observations ? `<p><b>Observations:</b> ${esc(t.observations)}</p>` : ""}${notesFor("test", t.id)}</div>` });
    }
    for (const d of ds) {
      srcIds.push(d.id);
      entries.push({ at: d.decidedAt, html: `<div class="entry"><span class="prov">decision · <span class="mono">${d.decidedAt.toISOString()}</span></span><h3>${esc(d.title)}</h3><p><b>Disposition:</b> ${esc(d.disposition)}</p>${notesFor("decision", d.id)}</div>` });
    }
    entries.sort((a, b) => a.at.getTime() - b.at.getTime());
    parts.push(entries.map((e) => e.html).join(""));
  }
  parts.push(`<hr><p class="prov">Manifest: ${srcIds.length} source entities · ${stuIds.length} student-authored notes · ${genIds.length} AI-generated notes</p></body></html>`);
  return { ext: "html", contentType: "text/html", manifest, body: parts.join("") };
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
export async function connectSource(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireTeam();
    assertRole(ctx, ["student_lead", "coach", "org_admin"]);
    const input = z.object({ provider: z.enum(["github", "onshape", "telegram", "discord"]), label: str(120).min(1), externalId: optStr(200), secret: optStr(500) }).parse(fd(formData));
    const webhookSecret = input.provider === "github" || input.provider === "discord" ? randomBytes(24).toString("hex") : null;
    const [row] = await db
      .insert(sourceConnections)
      .values({
        teamId: ctx.team.id,
        provider: input.provider,
        label: input.label,
        externalId: input.externalId,
        status: input.provider === "onshape" && !process.env.ONSHAPE_CLIENT_ID ? "pending" : input.provider === "telegram" && !input.secret ? "pending" : "active",
        encryptedSecret: encryptSecret(JSON.stringify({ webhookSecret, token: input.secret ?? null })),
        config: { webhookSecretHint: webhookSecret ? `${webhookSecret.slice(0, 6)}…` : null },
        createdBy: ctx.user.id,
      })
      .returning();
    await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "source.connected", entityType: "source_connection", entityId: row.id, metadata: { provider: input.provider } });
    await track("source.connected", { teamId: ctx.team.id, props: { provider: input.provider } });
    revalidatePath("/app/integrations");
    return { ok: true, id: row.id, message: webhookSecret ? `Connected. Webhook secret (shown once): ${webhookSecret}` : "Connected." };
  } catch (err) {
    return safeError(err);
  }
}

export async function disconnectSource(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin"]);
  const id = uuid.parse(formData.get("id"));
  await db.update(sourceConnections).set({ status: "disconnected", encryptedSecret: null }).where(and(eq(sourceConnections.id, id), eq(sourceConnections.teamId, ctx.team.id)));
  await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "source.disconnected", entityId: id });
  await track("source.disconnected", { teamId: ctx.team.id });
  revalidatePath("/app/integrations");
}

/** Development simulator: injects a realistic provider event through the same normalisation path as webhooks. */
export async function simulateSourceEvent(formData: FormData) {
  if (!devSimulatorEnabled()) throw new AuthorizationError("Not found");
  const ctx = await requireTeam();
  if (!ctx.canOrganize) throw new AuthorizationError();
  const provider = z.enum(["github", "onshape", "telegram"]).parse(formData.get("provider"));
  const { season, project } = await getActiveSeasonAndProject(ctx.team.id);
  const id = randomBytes(6).toString("hex");
  const samples = {
    github: { eventType: "commit", title: `fix: intake PID overshoot (${id.slice(0, 7)})`, meta: { repository: "team/orion-robot", sha: id + id, branch: "main", simulated: true } },
    onshape: { eventType: "cad_revision", title: `Intake roller spacing v${Math.floor(Math.random() * 30) + 1}`, meta: { documentId: "d-orion-intake", elementId: "e-roller", microversion: id, simulated: true } },
    telegram: { eventType: "message", title: "#test #intake 36 mm spacing 17/20 success", meta: { chat: "team-workshop", tags: ["test", "intake"], simulated: true } },
  } as const;
  const s = samples[provider];
  await db.insert(sourceEvents).values({ teamId: ctx.team.id, seasonId: season?.id ?? null, projectId: project?.id ?? null, provider, providerEventId: `sim-${id}`, eventType: s.eventType, actorExternalId: "dev-simulator", actorUserId: ctx.user.id, title: s.title, occurredAt: new Date(), rawMetadata: s.meta, contentHash: sha256(JSON.stringify(s)) }).onConflictDoNothing();
  await track("source.event_ingested", { teamId: ctx.team.id, props: { provider, simulated: true } });
  revalidatePath("/app/inbox");
  redirect("/app/inbox");
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------
export async function importCsv(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireTeam();
    if (!ctx.canAuthorStudentContent) return fail("Only students import test data.");
    const input = z.object({ csv: z.string().min(1).max(200_000), titleCol: str(60), trialsCol: optStr(60), successesCol: optStr(60), valueCol: optStr(60), unitsCol: optStr(60), dateCol: optStr(60), subsystemId: z.string().optional(), commit: z.string().optional() }).parse(fd(formData));
    const rows = parseCsv(input.csv);
    if (rows.length < 2) return fail("CSV needs a header row and at least one data row.");
    const header = rows[0].map((h) => h.trim());
    const idx = (name: string | null) => (name ? header.indexOf(name) : -1);
    const ti = idx(input.titleCol);
    if (ti < 0) return fail(`Column "${input.titleCol}" not found. Available: ${header.join(", ")}`);
    const tri = idx(input.trialsCol ?? null), si = idx(input.successesCol ?? null), vi = idx(input.valueCol ?? null), ui = idx(input.unitsCol ?? null), di = idx(input.dateCol ?? null);
    const errors: string[] = [];
    const parsed: Array<{ title: string; trials: number | null; successes: number | null; value: string | null; units: string | null; at: Date; line: number }> = [];
    rows.slice(1).forEach((r, n) => {
      const line = n + 2;
      const title = r[ti]?.trim();
      if (!title) return errors.push(`Line ${line}: empty title`);
      const num = (i: number, label: string) => {
        if (i < 0 || r[i] === undefined || r[i].trim() === "") return null;
        const v = Number(r[i]);
        if (!Number.isFinite(v)) {
          errors.push(`Line ${line}: ${label} "${r[i]}" is not a number`);
          return NaN;
        }
        return v;
      };
      const trials = num(tri, "trials"), successes = num(si, "successes"), value = num(vi, "value");
      if ([trials, successes, value].some((x) => Number.isNaN(x))) return;
      if (trials != null && successes != null && successes > trials) return errors.push(`Line ${line}: successes > trials`);
      let at = new Date();
      if (di >= 0 && r[di]) {
        const d = new Date(r[di]);
        if (Number.isNaN(d.getTime())) return errors.push(`Line ${line}: invalid date "${r[di]}"`);
        at = d;
      }
      parsed.push({ title, trials: trials as number | null, successes: successes as number | null, value: value == null ? null : String(value), units: ui >= 0 ? r[ui]?.trim() || null : null, at, line });
    });
    if (input.commit !== "yes") return { ok: true, message: `Preview: ${parsed.length} valid rows, ${errors.length} errors.${errors.length ? "\n" + errors.slice(0, 10).join("\n") : ""}` };
    const { season, project } = await getActiveSeasonAndProject(ctx.team.id);
    if (!project) return fail("No active project");
    const subsystemId = input.subsystemId ? uuid.parse(input.subsystemId) : null;
    if (subsystemId) await assertEntityInTeam(ctx.team.id, "subsystem", subsystemId);
    const batch = randomBytes(6).toString("hex");
    let imported = 0;
    for (const p of parsed) {
      const providerEventId = `csv-${batch}-${p.line}`;
      const [ev] = await db.insert(sourceEvents).values({ teamId: ctx.team.id, seasonId: season?.id ?? null, projectId: project.id, subsystemId, provider: "csv", providerEventId, eventType: "csv_row", actorUserId: ctx.user.id, title: p.title, occurredAt: p.at, rawMetadata: { batch, line: p.line }, contentHash: sha256(JSON.stringify(p)), status: "linked" }).returning();
      const [t] = await db.insert(tests).values({ teamId: ctx.team.id, projectId: project.id, subsystemId, title: p.title, trials: p.trials, successes: p.successes, value: p.value, units: p.units, metricName: p.trials != null ? "success rate" : null, outcome: "inconclusive", performedAt: p.at, createdBy: ctx.user.id }).returning();
      await db.insert(relations).values({ teamId: ctx.team.id, fromType: "test", fromId: t.id, toType: "source_event", toId: ev.id, relationType: "DERIVED_FROM", origin: "system", createdBy: ctx.user.id }).onConflictDoNothing();
      imported++;
    }
    await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: "csv.imported", metadata: { imported, errors: errors.length, batch } });
    revalidatePath("/app/tests");
    return { ok: true, message: `Imported ${imported} tests. ${errors.length} rows skipped.${errors.length ? "\n" + errors.slice(0, 10).join("\n") : ""}` };
  } catch (err) {
    return safeError(err);
  }
}

// ---------------------------------------------------------------------------
// Members, org, settings, notifications, handoff
// ---------------------------------------------------------------------------
export async function updateMember(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin"]);
  const input = z.object({ userId: uuid, role: z.enum(["student", "student_lead", "coach"]).optional(), status: z.enum(["active", "alumni", "removed"]).optional() }).parse(fd(formData));
  if (input.userId === ctx.user.id && input.status && input.status !== "active") throw new AuthorizationError("You cannot remove yourself.");
  const patch: Partial<typeof teamMemberships.$inferInsert> = {};
  if (input.role) patch.role = input.role;
  if (input.status) {
    patch.status = input.status;
    patch.leftAt = input.status === "active" ? null : new Date();
  }
  await db.update(teamMemberships).set(patch).where(and(eq(teamMemberships.teamId, ctx.team.id), eq(teamMemberships.userId, input.userId)));
  await audit({ teamId: ctx.team.id, actorUserId: ctx.user.id, action: input.role ? "member.role_changed" : "member.status_changed", entityType: "user", entityId: input.userId, metadata: input });
  revalidatePath("/app/members");
}

export async function updateSettings(formData: FormData) {
  const user = await requireUser();
  const input = z.object({ displayName: str(80).min(1), notifyExports: z.string().optional(), notifyPolicy: z.string().optional(), notifyGaps: z.string().optional(), ageCategory: z.enum(["unspecified", "under_13", "13_17", "adult"]) }).parse(fd(formData));
  await db.update(users).set({ displayName: input.displayName, ageCategory: input.ageCategory, settings: { notifyExports: input.notifyExports === "on", notifyPolicy: input.notifyPolicy === "on", notifyGaps: input.notifyGaps === "on" } }).where(eq(users.id, user.id));
  revalidatePath("/app/settings");
}

export async function markNotificationsRead() {
  const user = await requireUser();
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), sql`${notifications.readAt} is null`));
  revalidatePath("/app/notifications");
}

export async function curateHandoff(formData: FormData) {
  const ctx = await requireTeam();
  if (!ctx.canAuthorStudentContent) throw new AuthorizationError("Coaches cannot author the handoff narrative.");
  const input = z.object({ seasonId: uuid, subsystemId: uuid, body: str(5000).min(1), complete: z.string().optional() }).parse(fd(formData));
  await assertEntityInTeam(ctx.team.id, "subsystem", input.subsystemId);
  await writeAnnotation({ teamId: ctx.team.id, entityType: "subsystem", entityId: input.subsystemId, field: "handoff", body: input.body, authorUserId: ctx.user.id });
  revalidatePath("/app/handoff");
}

export async function completeHandoff(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin"]);
  const seasonId = uuid.parse(formData.get("seasonId"));
  await db.update(seasons).set({ handoffCompletedAt: new Date() }).where(and(eq(seasons.id, seasonId), eq(seasons.teamId, ctx.team.id)));
  await track("handoff.completed", { teamId: ctx.team.id, userId: ctx.user.id });
  revalidatePath("/app/handoff");
}

export async function startNewSeason(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "coach", "org_admin"]);
  const input = z.object({ name: str(60).min(1), year: z.coerce.number().int().min(2000).max(2100), projectName: str(120).min(1) }).parse(fd(formData));
  await db.update(seasons).set({ isActive: false }).where(eq(seasons.teamId, ctx.team.id));
  const [s] = await db.insert(seasons).values({ teamId: ctx.team.id, name: input.name, year: input.year, isActive: true }).returning();
  const [p] = await db.insert(projects).values({ teamId: ctx.team.id, seasonId: s.id, name: input.projectName }).returning();
  const prev = await db.select({ name: subsystems.name }).from(subsystems).where(eq(subsystems.teamId, ctx.team.id));
  const names = [...new Set(prev.map((x) => x.name))];
  if (names.length) await db.insert(subsystems).values(names.map((name) => ({ teamId: ctx.team.id, projectId: p.id, name })));
  await track("season.created", { teamId: ctx.team.id, userId: ctx.user.id });
  revalidatePath("/app", "layout");
}

export async function updateOrganization(formData: FormData) {
  const ctx = await requireTeam();
  if (!ctx.team.organizationId || ctx.orgRole !== "admin") throw new AuthorizationError("Organization admin required.");
  const input = z.object({ retentionDays: optStr(10), plan: z.enum(["free", "club", "school"]).optional() }).parse(fd(formData));
  const patch: Partial<typeof organizations.$inferInsert> = {};
  if (input.retentionDays !== undefined) patch.retentionDays = input.retentionDays ? Number(input.retentionDays) : null;
  if (input.plan) {
    if (process.env.STRIPE_SECRET_KEY) {
      // Live billing: plan changes go through the Stripe adapter (checkout) — never set directly.
      throw new Error("Live billing is configured; change plans via the billing portal.");
    }
    if (!developmentBillingEnabled()) throw new Error("Billing is not configured on this deployment.");
    patch.plan = input.plan;
    await db.update(subscriptions).set({ plan: input.plan, status: "active", updatedAt: new Date() }).where(eq(subscriptions.organizationId, ctx.team.organizationId));
  }
  await db.update(organizations).set(patch).where(eq(organizations.id, ctx.team.organizationId));
  await audit({ organizationId: ctx.team.organizationId, actorUserId: ctx.user.id, action: "organization.updated", metadata: input });
  revalidatePath("/app/org");
}

export async function deleteTeam(formData: FormData) {
  const ctx = await requireTeam();
  assertRole(ctx, ["student_lead", "org_admin"]);
  const confirm = str(120).parse(formData.get("confirm"));
  if (confirm !== ctx.team.name) throw new Error("Confirmation text does not match the team name.");
  await audit({ teamId: ctx.team.id, organizationId: ctx.team.organizationId, actorUserId: ctx.user.id, action: "team.deleted", entityType: "team", entityId: ctx.team.id });
  await enqueueJob("storage.cleanup", { teamId: ctx.team.id }, `cleanup-${ctx.team.id}`);
  await db.delete(teams).where(eq(teams.id, ctx.team.id));
  const jar = await cookies();
  jar.delete("pt_team");
  redirect("/onboarding");
}
