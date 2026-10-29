-- Additive unified workspace extension. Existing entity tables remain canonical.
CREATE TABLE workspace_project_state (
  project_id uuid PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  node_positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  educational_origin boolean NOT NULL DEFAULT false,
  import_manifest jsonb,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE workspace_entity_map (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  local_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('source_event','iteration','test','decision','relation')),
  entity_id uuid NOT NULL,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  imported_by uuid REFERENCES users(id) ON DELETE SET NULL,
  original_author_label text NOT NULL DEFAULT '',
  PRIMARY KEY (project_id, local_id),
  UNIQUE (entity_type, entity_id)
);
--> statement-breakpoint
CREATE TABLE workspace_requests (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  team_id uuid REFERENCES teams(id) ON DELETE CASCADE,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
--> statement-breakpoint
ALTER TABLE relations ADD COLUMN invalidated_at timestamptz;
--> statement-breakpoint
CREATE INDEX annotations_workspace_snapshot_idx ON annotations (entity_id, created_at DESC)
  WHERE entity_type = 'project' AND field = 'workspace_snapshot';
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.workspace_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;
--> statement-breakpoint
-- Owner executes only this narrow lookup; it avoids recursive membership RLS.
CREATE OR REPLACE FUNCTION public.workspace_member_role(wanted_team uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT role FROM public.team_memberships
  WHERE team_id = wanted_team AND user_id = public.workspace_user_id() AND status = 'active'
  LIMIT 1
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.workspace_create_team(team_name text, season_name text, project_name text, team_zone text, team_program text, team_locale text)
RETURNS TABLE(team_id uuid, project_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid := public.workspace_user_id(); tid uuid; sid uuid; pid uuid;
BEGIN
  IF uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.account_verification WHERE user_id=uid AND verified_at IS NOT NULL) THEN
    RAISE EXCEPTION 'verified account required' USING ERRCODE='42501';
  END IF;
  IF length(trim(team_name)) NOT BETWEEN 1 AND 120 OR length(trim(project_name)) NOT BETWEEN 1 AND 120
    OR length(trim(season_name)) NOT BETWEEN 1 AND 80 OR team_locale NOT IN ('en','ru','kk')
    OR team_program NOT IN ('FTC','VEX','FRC','ISEF','OTHER')
    OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=team_zone) THEN
    RAISE EXCEPTION 'invalid team fields' USING ERRCODE='22023';
  END IF;
  IF (SELECT count(*) FROM public.team_memberships WHERE user_id=uid AND status='active') >= 20 THEN
    RAISE EXCEPTION 'team limit reached' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.teams(name,program,timezone,default_locale) VALUES(trim(team_name),team_program,team_zone,team_locale) RETURNING id INTO tid;
  INSERT INTO public.team_memberships(team_id,user_id,role) VALUES(tid,uid,'student_lead');
  INSERT INTO public.seasons(team_id,name,year,is_active) VALUES(tid,trim(season_name),extract(year FROM now())::integer,true) RETURNING id INTO sid;
  INSERT INTO public.projects(team_id,season_id,name) VALUES(tid,sid,trim(project_name)) RETURNING id INTO pid;
  INSERT INTO public.workspace_project_state(project_id,team_id,created_by) VALUES(pid,tid,uid);
  RETURN QUERY SELECT tid,pid;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.workspace_join_invite(invite_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE uid uuid := public.workspace_user_id(); invitation public.team_invites%ROWTYPE; account_email text;
BEGIN
  SELECT u.email INTO account_email FROM public.users u JOIN public.account_verification av ON av.user_id=u.id
    WHERE u.id=uid AND av.verified_at IS NOT NULL;
  IF account_email IS NULL THEN RAISE EXCEPTION 'verified account required' USING ERRCODE='42501'; END IF;
  SELECT * INTO invitation FROM public.team_invites WHERE code=invite_hash FOR UPDATE;
  IF NOT FOUND OR invitation.revoked_at IS NOT NULL OR invitation.expires_at <= now()
    OR invitation.uses >= invitation.max_uses OR invitation.role <> 'student'
    OR (invitation.email IS NOT NULL AND lower(invitation.email) <> lower(account_email)) THEN
    RAISE EXCEPTION 'invite unavailable' USING ERRCODE='42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id=invitation.team_id AND user_id=uid) THEN
    IF EXISTS (SELECT 1 FROM public.team_memberships WHERE team_id=invitation.team_id AND user_id=uid AND status='active') THEN
      RETURN invitation.team_id;
    END IF;
    RAISE EXCEPTION 'membership requires review' USING ERRCODE='42501';
  END IF;
  INSERT INTO public.team_memberships(team_id,user_id,role) VALUES(invitation.team_id,uid,'student');
  UPDATE public.team_invites SET uses=uses+1 WHERE id=invitation.id;
  RETURN invitation.team_id;
END $$;
--> statement-breakpoint
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_teams_read ON teams FOR SELECT USING (public.workspace_member_role(id) IS NOT NULL);
--> statement-breakpoint
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_members_read ON team_memberships FOR SELECT
  USING (public.workspace_member_role(team_id) IS NOT NULL);
--> statement-breakpoint
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_invites_read ON team_invites FOR SELECT USING (public.workspace_member_role(team_id) IN ('student_lead','coach'));
CREATE POLICY workspace_invites_insert ON team_invites FOR INSERT WITH CHECK
  (public.workspace_member_role(team_id) IN ('student_lead','coach') AND role='student' AND created_by=public.workspace_user_id());
CREATE POLICY workspace_invites_revoke ON team_invites FOR UPDATE
  USING (public.workspace_member_role(team_id) IN ('student_lead','coach'))
  WITH CHECK (role='student' AND public.workspace_member_role(team_id) IN ('student_lead','coach'));
--> statement-breakpoint
-- RLS is defense in depth. Service-level ownership/role validation remains mandatory.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'seasons','projects','subsystems','source_connections','source_events','artifacts','robot_models',
    'iterations','tests','decisions','relations','exports','audit_events','ai_action_logs',
    'analytics_events','workspace_project_state','workspace_entity_map'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY workspace_read ON public.%I FOR SELECT USING (public.workspace_member_role(team_id) IS NOT NULL)',table_name);
    EXECUTE format('CREATE POLICY workspace_write ON public.%I FOR INSERT WITH CHECK (public.workspace_member_role(team_id) IN (''student'',''student_lead''))',table_name);
    EXECUTE format('CREATE POLICY workspace_update ON public.%I FOR UPDATE USING (public.workspace_member_role(team_id) IN (''student'',''student_lead'')) WITH CHECK (public.workspace_member_role(team_id) IN (''student'',''student_lead''))',table_name);
  END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_annotations_read ON annotations FOR SELECT USING (public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY workspace_annotations_insert ON annotations FOR INSERT WITH CHECK
 (author_user_id=public.workspace_user_id() AND
  (public.workspace_member_role(team_id) IN ('student','student_lead') OR
   (public.workspace_member_role(team_id)='coach' AND field='coach_note')));
--> statement-breakpoint
ALTER TABLE workspace_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_requests_own ON workspace_requests FOR ALL
  USING (user_id=public.workspace_user_id())
  WITH CHECK (user_id=public.workspace_user_id() AND (team_id IS NULL OR public.workspace_member_role(team_id) IS NOT NULL));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.workspace_guard_source() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['status','iteration_id','subsystem_id','visibility'])
    IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status','iteration_id','subsystem_id','visibility']) THEN
    RAISE EXCEPTION 'source originals are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER workspace_source_immutable BEFORE UPDATE ON source_events
 FOR EACH ROW EXECUTE FUNCTION public.workspace_guard_source();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.workspace_guard_annotation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'annotations are append-only' USING ERRCODE='23514'; END $$;
CREATE TRIGGER workspace_annotations_append_only BEFORE UPDATE ON annotations
 FOR EACH ROW EXECUTE FUNCTION public.workspace_guard_annotation();

