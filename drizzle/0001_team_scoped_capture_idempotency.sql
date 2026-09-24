DROP INDEX IF EXISTS "source_events_client_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "source_events_client_id_idx" ON "source_events" USING btree ("team_id","client_id");
