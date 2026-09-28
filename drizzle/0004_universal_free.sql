-- DRAFT: not registered in meta/_journal.json and not applied.
-- Requires the matching application/schema changes before registration.
-- Remove monetization from the active schema without losing historical records.
-- Run through the transactional Drizzle migrator, after a verified database backup.
-- No organization, team, membership or evidence record is deleted.
CREATE SCHEMA IF NOT EXISTS tracelab_legacy;
--> statement-breakpoint
REVOKE ALL ON SCHEMA tracelab_legacy FROM PUBLIC;
--> statement-breakpoint
CREATE TABLE tracelab_legacy.organization_plans AS
  SELECT id AS organization_id, plan, now() AS archived_at FROM public.organizations;
--> statement-breakpoint
ALTER TABLE public.subscriptions SET SCHEMA tracelab_legacy;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA tracelab_legacy FROM PUBLIC;
--> statement-breakpoint
ALTER TABLE public.organizations DROP COLUMN plan;
