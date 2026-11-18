-- Durable export intent precedes storage writes. Finished exports are immutable.
CREATE TABLE workspace_export_jobs (
  export_id uuid PRIMARY KEY REFERENCES exports(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  storage_key text NOT NULL,
  input jsonb NOT NULL,
  state text NOT NULL DEFAULT 'queued' CHECK (state IN ('queued','rendering','ready','failed','cancelled','cleanup_pending')),
  attempt integer NOT NULL DEFAULT 0,
  lease_until timestamptz,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,request_id)
);
--> statement-breakpoint
ALTER TABLE workspace_export_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_export_job_read ON workspace_export_jobs FOR SELECT USING (public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY workspace_export_job_insert ON workspace_export_jobs FOR INSERT WITH CHECK
 (user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IN ('student','student_lead'));
CREATE POLICY workspace_export_job_update ON workspace_export_jobs FOR UPDATE USING
 (user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IN ('student','student_lead')) WITH CHECK
 (user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IN ('student','student_lead'));
CREATE INDEX workspace_export_recovery_idx ON workspace_export_jobs(state,lease_until);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.workspace_guard_export() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='ready' AND to_jsonb(NEW) IS DISTINCT FROM to_jsonb(OLD) THEN
    RAISE EXCEPTION 'finished exports are immutable; create a new version' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workspace_finished_export_immutable BEFORE UPDATE ON exports
 FOR EACH ROW EXECUTE FUNCTION public.workspace_guard_export();
