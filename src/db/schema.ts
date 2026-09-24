import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    locale: text("locale").notNull().default("en"),
    platformRole: text("platform_role").notNull().default("user"), // user | platform_admin
    ageCategory: text("age_category").notNull().default("unspecified"), // unspecified | under_13 | 13_17 | adult
    settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// ---------------------------------------------------------------------------
// Organizations & teams
// ---------------------------------------------------------------------------
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("free"), // free | club | school
  retentionDays: integer("retention_days"), // null = keep indefinitely
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"), // admin | coach | member
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("org_membership_unique").on(t.organizationId, t.userId)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    number: text("number"),
    program: text("program").notNull().default("FTC"), // FTC | VEX | FRC | ISEF | OTHER
    timezone: text("timezone").notNull().default("UTC"),
    defaultLocale: text("default_locale").notNull().default("en"),
    competitionProfileId: uuid("competition_profile_id"),
    studentOwnedMode: boolean("student_owned_mode").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("teams_org_idx").on(t.organizationId)],
);

export const teamMemberships = pgTable(
  "team_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("student"), // student | student_lead | coach
    status: text("status").notNull().default("active"), // active | alumni | removed
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("team_membership_unique").on(t.teamId, t.userId),
    index("team_membership_user_idx").on(t.userId),
  ],
);

export const teamInvites = pgTable(
  "team_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    role: text("role").notNull().default("student"),
    email: text("email"),
    maxUses: integer("max_uses").notNull().default(1),
    uses: integer("uses").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("team_invites_code_idx").on(t.code)],
);

// ---------------------------------------------------------------------------
// Seasons / projects / subsystems
// ---------------------------------------------------------------------------
export const seasons = pgTable(
  "seasons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    year: integer("year").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    handoffCurated: jsonb("handoff_curated").notNull().default(sql`'{}'::jsonb`),
    handoffCompletedAt: timestamp("handoff_completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("seasons_team_idx").on(t.teamId)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_team_idx").on(t.teamId), index("projects_season_idx").on(t.seasonId)],
);

export const subsystems = pgTable(
  "subsystems",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subsystems_project_idx").on(t.projectId), index("subsystems_team_idx").on(t.teamId)],
);

// ---------------------------------------------------------------------------
// Sources & evidence
// ---------------------------------------------------------------------------
export const sourceConnections = pgTable(
  "source_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // github | onshape | telegram | discord | csv | upload
    externalId: text("external_id"),
    label: text("label").notNull(),
    status: text("status").notNull().default("active"), // active | disconnected | error | pending
    encryptedSecret: text("encrypted_secret"),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("source_connections_team_idx").on(t.teamId), index("source_connections_provider_idx").on(t.provider, t.externalId)],
);

/** Append-only. Never updated except for triage fields (status / iterationId / subsystemId). */
export const sourceEvents = pgTable(
  "source_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid("season_id").references(() => seasons.id, { onDelete: "set null" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    subsystemId: uuid("subsystem_id").references(() => subsystems.id, { onDelete: "set null" }),
    connectionId: uuid("connection_id").references(() => sourceConnections.id, { onDelete: "set null" }),
    iterationId: uuid("iteration_id"),
    provider: text("provider").notNull(), // github | onshape | telegram | discord | capture | csv | upload
    providerEventId: text("provider_event_id").notNull(),
    eventType: text("event_type").notNull(), // commit | push | cad_revision | photo | problem | test | decision | reflection | message | csv_row
    actorExternalId: text("actor_external_id"),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    summary: text("summary"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    rawMetadata: jsonb("raw_metadata").notNull().default(sql`'{}'::jsonb`),
    contentHash: text("content_hash").notNull(),
    visibility: text("visibility").notNull().default("team"), // team | sensitive
    status: text("status").notNull().default("inbox"), // inbox | linked | ignored
    clientId: text("client_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("source_events_provider_unique").on(t.teamId, t.provider, t.providerEventId),
    uniqueIndex("source_events_client_id_idx").on(t.teamId, t.clientId),
    index("source_events_team_time_idx").on(t.teamId, t.occurredAt),
    index("source_events_project_idx").on(t.projectId),
    index("source_events_subsystem_idx").on(t.subsystemId),
    index("source_events_iteration_idx").on(t.iterationId),
    index("source_events_status_idx").on(t.teamId, t.status),
    index("source_events_hash_idx").on(t.contentHash),
  ],
);

export const artifacts = pgTable(
  "artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    sourceEventId: uuid("source_event_id")
      .notNull()
      .references(() => sourceEvents.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // commit | cad_revision | photo | video | drawing | csv | test_file | document
    externalReference: text("external_reference"),
    storageKey: text("storage_key"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    sha256: text("sha256"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("artifacts_team_idx").on(t.teamId),
    index("artifacts_event_idx").on(t.sourceEventId),
    index("artifacts_sha_idx").on(t.sha256),
  ],
);

/** Student-authored reasoning. Versioned via supersedesId; never destructively edited. */
export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(), // source_event | iteration | test | decision | subsystem | artifact
    entityId: uuid("entity_id").notNull(),
    field: text("field").notNull().default("note"), // note | rationale | problem | change | next_step | reflection | caption
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    sourceMethod: text("source_method").notNull().default("typed"), // typed | voice_exact | import
    provenance: text("provenance").notNull().default("student"), // student | system | suggestion | ai | source
    supersedesId: uuid("supersedes_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("annotations_entity_idx").on(t.entityType, t.entityId), index("annotations_team_idx").on(t.teamId)],
);

export const iterations = pgTable(
  "iterations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    subsystemId: uuid("subsystem_id").references(() => subsystems.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    state: text("state").notNull().default("open"), // open | testing | deciding | closed
    problemOrGoal: text("problem_or_goal"),
    changeSummary: text("change_summary"),
    outcome: text("outcome"), // kept | reverted | rejected | deferred | null
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("iterations_team_idx").on(t.teamId, t.openedAt),
    index("iterations_project_idx").on(t.projectId),
    index("iterations_subsystem_idx").on(t.subsystemId),
    index("iterations_state_idx").on(t.teamId, t.state),
  ],
);

export const tests = pgTable(
  "tests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    subsystemId: uuid("subsystem_id").references(() => subsystems.id, { onDelete: "set null" }),
    iterationId: uuid("iteration_id").references(() => iterations.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    targetType: text("target_type").notNull().default("subsystem"), // subsystem | artifact | revision | commit | prototype | project
    targetLabel: text("target_label"),
    question: text("question"),
    hypothesis: text("hypothesis"),
    procedure: text("procedure"),
    independentVariable: text("independent_variable"),
    metricName: text("metric_name"),
    units: text("units"),
    trials: integer("trials"),
    successes: integer("successes"),
    value: numeric("value"),
    passCriteria: text("pass_criteria"),
    environment: text("environment"),
    observations: text("observations"),
    outcome: text("outcome").notNull().default("inconclusive"), // pass | fail | inconclusive | qualitative
    performedAt: timestamp("performed_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tests_team_idx").on(t.teamId, t.performedAt),
    index("tests_subsystem_idx").on(t.subsystemId),
    index("tests_iteration_idx").on(t.iterationId),
    index("tests_outcome_idx").on(t.teamId, t.outcome),
  ],
);

export const decisions = pgTable(
  "decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    subsystemId: uuid("subsystem_id").references(() => subsystems.id, { onDelete: "set null" }),
    iterationId: uuid("iteration_id").references(() => iterations.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    disposition: text("disposition").notNull().default("unknown"), // keep | revert | iterate | defer | reject | unknown
    status: text("status").notNull().default("closed"), // open | closed | reversed
    alternatives: jsonb("alternatives").notNull().default(sql`'[]'::jsonb`),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull().defaultNow(),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    reversedById: uuid("reversed_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("decisions_team_idx").on(t.teamId, t.decidedAt),
    index("decisions_subsystem_idx").on(t.subsystemId),
    index("decisions_iteration_idx").on(t.iterationId),
    index("decisions_status_idx").on(t.teamId, t.status),
  ],
);

/** Typed relations between evidence entities. Machine suggestions stay status=suggested until accepted. */
export const relations = pgTable(
  "relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    fromType: text("from_type").notNull(),
    fromId: uuid("from_id").notNull(),
    toType: text("to_type").notNull(),
    toId: uuid("to_id").notNull(),
    relationType: text("relation_type").notNull(),
    origin: text("origin").notNull().default("student"), // student | system | suggestion | ai
    status: text("status").notNull().default("accepted"), // accepted | suggested | rejected
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("relations_unique").on(t.fromType, t.fromId, t.toType, t.toId, t.relationType),
    index("relations_from_idx").on(t.fromType, t.fromId),
    index("relations_to_idx").on(t.toType, t.toId),
    index("relations_team_idx").on(t.teamId),
  ],
);

// ---------------------------------------------------------------------------
// Competition policy
// ---------------------------------------------------------------------------
export const competitionProfiles = pgTable("competition_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(), // vex_strict | ftc_2025_26 | ftc_2026_27 | isef_2027 | generic
  program: text("program").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  strict: boolean("strict").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => competitionProfiles.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    status: text("status").notNull().default("draft"), // draft | active | superseded | needs_review
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewer: text("reviewer"),
    sourceUrls: jsonb("source_urls").notNull().default(sql`'[]'::jsonb`),
    changelog: text("changelog"),
    constraints: jsonb("constraints").notNull().default(sql`'{}'::jsonb`), // e.g. maxPages, maxFileMb
    actionMatrix: jsonb("action_matrix").notNull().default(sql`'{}'::jsonb`),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("policy_versions_unique").on(t.profileId, t.version), index("policy_versions_status_idx").on(t.profileId, t.status)],
);

export const aiActionLogs = pgTable(
  "ai_action_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    policyVersionId: uuid("policy_version_id").references(() => policyVersions.id, { onDelete: "set null" }),
    policyDecision: text("policy_decision").notNull(),
    referencedEntities: jsonb("referenced_entities").notNull().default(sql`'[]'::jsonb`),
    provider: text("provider"),
    model: text("model"),
    prompt: text("prompt"),
    output: text("output"),
    outputHash: text("output_hash"),
    disposition: text("disposition").notNull().default("pending"), // pending | accepted | rejected | blocked
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_logs_team_idx").on(t.teamId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Exports, audit, notifications, jobs, billing, analytics
// ---------------------------------------------------------------------------
export const exports = pgTable(
  "exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // vex_notebook | ftc_portfolio | season_handoff | personal_contribution | team_data
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    forUserId: uuid("for_user_id"),
    policyVersionId: uuid("policy_version_id").references(() => policyVersions.id, { onDelete: "set null" }),
    policyDecision: text("policy_decision"),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    manifest: jsonb("manifest").notNull().default(sql`'{}'::jsonb`),
    hash: text("hash"),
    storageKey: text("storage_key"),
    status: text("status").notNull().default("ready"), // queued | ready | failed | blocked
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exports_team_idx").on(t.teamId, t.createdAt)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id"),
    organizationId: uuid("organization_id"),
    actorUserId: uuid("actor_user_id"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_team_idx").on(t.teamId, t.createdAt), index("audit_org_idx").on(t.organizationId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    teamId: uuid("team_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    idempotencyKey: text("idempotency_key"),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    status: text("status").notNull().default("queued"), // queued | running | done | failed
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("jobs_idempotency_idx").on(t.idempotencyKey), index("jobs_status_idx").on(t.status, t.runAfter)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    deliveryId: text("delivery_id").notNull(),
    status: text("status").notNull().default("received"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_delivery_unique").on(t.provider, t.deliveryId)],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("stripe"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    plan: text("plan").notNull().default("free"),
    status: text("status").notNull().default("inactive"), // inactive | active | past_due | canceled | trialing
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("subscriptions_org_idx").on(t.organizationId), uniqueIndex("subscriptions_provider_sub_idx").on(t.providerSubscriptionId)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    teamId: uuid("team_id"),
    userId: uuid("user_id"),
    props: jsonb("props").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analytics_name_idx").on(t.name, t.createdAt)],
);

export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description"),
});
