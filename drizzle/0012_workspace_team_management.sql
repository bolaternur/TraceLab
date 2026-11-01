ALTER TABLE teams ADD COLUMN workspace_settings_version integer NOT NULL DEFAULT 0 CHECK (workspace_settings_version >= 0);
--> statement-breakpoint
CREATE FUNCTION public.workspace_manage_member(wanted_team uuid,target_user uuid,desired_role text,desired_status text,expected_role text,expected_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid:=public.workspace_user_id(); target public.team_memberships%ROWTYPE; other_leads integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-manage:'||wanted_team::text,0));
  IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_verification WHERE user_id=uid AND verified_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.team_memberships WHERE team_id=wanted_team AND user_id=uid AND role='student_lead' AND status='active') THEN
    RAISE EXCEPTION 'team lead required' USING ERRCODE='42501';
  END IF;
  IF desired_role IS NULL OR desired_status IS NULL OR expected_role IS NULL OR expected_status IS NULL
    OR desired_role NOT IN ('student','student_lead') OR desired_status NOT IN ('active','removed') THEN
    RAISE EXCEPTION 'invalid member transition' USING ERRCODE='22023';
  END IF;
  SELECT * INTO target FROM public.team_memberships WHERE team_id=wanted_team AND user_id=target_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'member unavailable' USING ERRCODE='42501'; END IF;
  -- Student leads cannot appoint, replace or remove a trusted adult role.
  -- Adult-role administration requires a separately reviewed organization flow.
  IF target.role NOT IN ('student','student_lead') THEN
    RAISE EXCEPTION 'adult membership requires separate administration' USING ERRCODE='42501';
  END IF;
  IF target.role<>expected_role OR target.status<>expected_status THEN
    RAISE EXCEPTION 'member changed' USING ERRCODE='40001';
  END IF;
  IF target.role='student_lead' AND target.status='active' AND (desired_role<>'student_lead' OR desired_status<>'active') THEN
    SELECT count(*) INTO other_leads FROM public.team_memberships WHERE team_id=wanted_team AND role='student_lead' AND status='active' AND user_id<>target_user;
    IF other_leads=0 THEN RAISE EXCEPTION 'last active lead required' USING ERRCODE='23514'; END IF;
  END IF;
  IF target.role=desired_role AND target.status=desired_status THEN RETURN; END IF;
  UPDATE public.team_memberships SET role=desired_role,status=desired_status,left_at=CASE WHEN desired_status='removed' THEN now() ELSE NULL END WHERE id=target.id;
  INSERT INTO public.audit_events(team_id,actor_user_id,action,entity_type,entity_id,metadata)
    VALUES(wanted_team,uid,'team.member.changed','user',target_user,
      jsonb_build_object('before',jsonb_build_object('role',target.role,'status',target.status),'after',jsonb_build_object('role',desired_role,'status',desired_status)));
END $$;
REVOKE ALL ON FUNCTION public.workspace_manage_member(uuid,uuid,text,text,text,text) FROM PUBLIC;
--> statement-breakpoint
CREATE FUNCTION public.workspace_update_team(wanted_team uuid,new_name text,new_timezone text,new_locale text,expected_version integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid:=public.workspace_user_id(); previous public.teams%ROWTYPE;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-manage:'||wanted_team::text,0));
  IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_verification WHERE user_id=uid AND verified_at IS NOT NULL)
    OR NOT EXISTS(SELECT 1 FROM public.team_memberships WHERE team_id=wanted_team AND user_id=uid AND role='student_lead' AND status='active') THEN
    RAISE EXCEPTION 'team lead required' USING ERRCODE='42501';
  END IF;
  IF new_name IS NULL OR new_timezone IS NULL OR new_locale IS NULL OR expected_version IS NULL OR expected_version<0
    OR length(trim(new_name)) NOT BETWEEN 1 AND 120 OR new_locale NOT IN ('ru','en','kk')
    OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=new_timezone) THEN
    RAISE EXCEPTION 'invalid settings' USING ERRCODE='22023';
  END IF;
  SELECT * INTO previous FROM public.teams WHERE id=wanted_team FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'team unavailable' USING ERRCODE='42501'; END IF;
  IF previous.workspace_settings_version<>expected_version THEN RAISE EXCEPTION 'settings changed' USING ERRCODE='40001'; END IF;
  UPDATE public.teams SET name=trim(new_name),timezone=new_timezone,default_locale=new_locale,workspace_settings_version=workspace_settings_version+1 WHERE id=wanted_team;
  INSERT INTO public.audit_events(team_id,actor_user_id,action,entity_type,entity_id,metadata)
    VALUES(wanted_team,uid,'team.settings.changed','team',wanted_team,
      jsonb_build_object('before',jsonb_build_object('name',previous.name,'timezone',previous.timezone,'locale',previous.default_locale),
      'after',jsonb_build_object('name',trim(new_name),'timezone',new_timezone,'locale',new_locale)));
END $$;
REVOKE ALL ON FUNCTION public.workspace_update_team(uuid,text,text,text,integer) FROM PUBLIC;
