-- Durable reservations are separate from finalized immutable source artifacts.
CREATE TABLE workspace_uploads (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  payload_hash text NOT NULL,
  reserved_bytes bigint NOT NULL CHECK (reserved_bytes >= 0),
  storage_keys jsonb NOT NULL,
  status text NOT NULL DEFAULT 'staging' CHECK (status IN ('staging','finalized','cleanup_pending','cleaned')),
  artifact_id uuid REFERENCES artifacts(id) ON DELETE SET NULL,
  model_id uuid REFERENCES robot_models(id) ON DELETE SET NULL,
  record_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  UNIQUE (user_id,request_id)
);
--> statement-breakpoint
CREATE INDEX workspace_uploads_cleanup_idx ON workspace_uploads (team_id,status,expires_at);
--> statement-breakpoint
ALTER TABLE workspace_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_upload_read ON workspace_uploads FOR SELECT USING
  (public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY workspace_upload_insert ON workspace_uploads FOR INSERT WITH CHECK
  (user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IN ('student','student_lead'));
CREATE POLICY workspace_upload_update ON workspace_uploads FOR UPDATE USING
  (public.workspace_member_role(team_id) IN ('student','student_lead')) WITH CHECK
  (public.workspace_member_role(team_id) IN ('student','student_lead'));
--> statement-breakpoint
-- Coaches can audit private reads but cannot author a source or change an artifact.
CREATE POLICY workspace_media_read_audit ON audit_events FOR INSERT WITH CHECK
  (actor_user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL
   AND action IN ('media.read','media.list') AND entity_type IN ('artifact','project'));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.workspace_guard_artifact() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'artifact source bytes and metadata are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workspace_artifact_immutable BEFORE UPDATE ON artifacts
  FOR EACH ROW EXECUTE FUNCTION public.workspace_guard_artifact();
