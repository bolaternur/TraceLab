-- Preview confirmation is bound to user, target team and exact input bytes.
CREATE TABLE workspace_import_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE, payload_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'), committed_project_id uuid REFERENCES projects(id)
);
--> statement-breakpoint
ALTER TABLE workspace_import_previews ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_import_own ON workspace_import_previews FOR ALL
 USING (user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL)
 WITH CHECK (user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IN ('student','student_lead'));
--> statement-breakpoint
-- Removing a link invalidates it; re-adding it creates a separate historical row.
DROP INDEX relations_unique;
CREATE UNIQUE INDEX relations_active_unique ON relations(from_type,from_id,to_type,to_id,relation_type) WHERE invalidated_at IS NULL;
