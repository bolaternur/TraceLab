ALTER TABLE "team_invites"
  ADD CONSTRAINT "team_invites_usage_bounds" CHECK ("max_uses" > 0 AND "uses" >= 0 AND "uses" <= "max_uses");--> statement-breakpoint
ALTER TABLE "team_invites"
  ADD CONSTRAINT "team_invites_role_allowed" CHECK ("role" IN ('student', 'student_lead', 'coach'));--> statement-breakpoint
ALTER TABLE "relations"
  ADD CONSTRAINT "relations_from_type_allowed" CHECK ("from_type" IN ('source_event', 'artifact', 'iteration', 'test', 'decision', 'subsystem', 'project'));--> statement-breakpoint
ALTER TABLE "relations"
  ADD CONSTRAINT "relations_to_type_allowed" CHECK ("to_type" IN ('source_event', 'artifact', 'iteration', 'test', 'decision', 'subsystem', 'project'));--> statement-breakpoint
CREATE UNIQUE INDEX "policy_versions_one_active_per_profile"
  ON "policy_versions" ("profile_id") WHERE "status" = 'active';
