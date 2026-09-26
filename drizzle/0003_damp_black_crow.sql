CREATE TABLE "robot_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"project_id" uuid,
	"subsystem_id" uuid,
	"source_event_id" uuid NOT NULL,
	"artifact_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'part' NOT NULL,
	"version_label" text,
	"description" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "source_events_client_id_idx";--> statement-breakpoint
ALTER TABLE "robot_models" ADD CONSTRAINT "robot_models_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_models" ADD CONSTRAINT "robot_models_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_models" ADD CONSTRAINT "robot_models_subsystem_id_subsystems_id_fk" FOREIGN KEY ("subsystem_id") REFERENCES "public"."subsystems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_models" ADD CONSTRAINT "robot_models_source_event_id_source_events_id_fk" FOREIGN KEY ("source_event_id") REFERENCES "public"."source_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_models" ADD CONSTRAINT "robot_models_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "robot_models" ADD CONSTRAINT "robot_models_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "robot_models_team_idx" ON "robot_models" USING btree ("team_id","updated_at");--> statement-breakpoint
CREATE INDEX "robot_models_project_idx" ON "robot_models" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "robot_models_subsystem_idx" ON "robot_models" USING btree ("subsystem_id");--> statement-breakpoint
CREATE UNIQUE INDEX "robot_models_artifact_idx" ON "robot_models" USING btree ("artifact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_events_client_id_idx" ON "source_events" USING btree ("team_id","client_id");