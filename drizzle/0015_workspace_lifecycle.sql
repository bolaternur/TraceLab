-- Reviewed narrow lifecycle migration. Isolated fixture proof: 11/11, fresh DB 1793519289940_5f6cff18.
-- No blanket table triggers; existing data remains active until an explicit authenticated closure request.
CREATE TABLE workspace_lifecycle_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),kind text NOT NULL CHECK(kind IN ('team','account')),target_id uuid NOT NULL,
 requested_by uuid NOT NULL,state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','purging','purged','cancelled')),
 requested_at timestamptz NOT NULL DEFAULT now(),purge_after timestamptz NOT NULL DEFAULT now()+interval '7 days',
 completed_at timestamptz,lease_until timestamptz,claim_token uuid,attempts integer NOT NULL DEFAULT 0,failures integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),last_error text,summary jsonb NOT NULL DEFAULT '{}'::jsonb,
 cleanup_keys jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(cleanup_keys)='array'),all_keys jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(all_keys)='array')
);
CREATE UNIQUE INDEX lifecycle_active_target ON workspace_lifecycle_requests(kind,target_id) WHERE state IN ('pending','purging');
ALTER TABLE workspace_lifecycle_requests ENABLE ROW LEVEL SECURITY;
-- A committed unresolved PUT is never assumed finished merely because time passed.
CREATE TABLE workspace_lifecycle_storage_writes(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL,user_id uuid,key text NOT NULL,started_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE workspace_lifecycle_storage_writes ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.workspace_lifecycle_key_team(object_key text) RETURNS uuid
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF object_key IS NULL OR object_key !~* '^(chat/)?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$' OR EXISTS(SELECT 1 FROM unnest(string_to_array(object_key,'/')) segment WHERE segment IN ('.','..')) THEN RAISE EXCEPTION 'unsafe cleanup key' USING ERRCODE='22023'; END IF;
 RETURN split_part(object_key,'/',CASE WHEN lower(split_part(object_key,'/',1))='chat' THEN 2 ELSE 1 END)::uuid;
END $$;
REVOKE ALL ON FUNCTION public.workspace_lifecycle_key_team(text) FROM PUBLIC;
CREATE FUNCTION public.workspace_lifecycle_account_open(wanted_user uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.workspace_lifecycle_requests WHERE kind='account' AND target_id=wanted_user AND state IN ('pending','purging','purged'))
$$;
CREATE FUNCTION public.workspace_lifecycle_team_open(wanted_team uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.workspace_lifecycle_requests WHERE kind='team' AND target_id=wanted_team AND state IN ('pending','purging','purged'))
$$;
CREATE OR REPLACE FUNCTION public.workspace_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT CASE WHEN public.workspace_lifecycle_account_open(nullif(current_setting('app.user_id',true),'')::uuid)
 THEN nullif(current_setting('app.user_id',true),'')::uuid ELSE NULL END
$$;
CREATE OR REPLACE FUNCTION public.workspace_member_role(wanted_team uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT role FROM public.team_memberships WHERE team_id=wanted_team AND user_id=public.workspace_user_id() AND status='active'
 AND public.workspace_lifecycle_team_open(wanted_team) LIMIT 1
$$;
-- Explicit privileged paths; no blanket triggers are installed.
ALTER FUNCTION public.workspace_join_invite(text) RENAME TO lifecycle_original_join_invite;
ALTER FUNCTION public.workspace_update_team(uuid,text,text,text,integer) RENAME TO lifecycle_original_update_team;
ALTER FUNCTION public.workspace_manage_member(uuid,uuid,text,text,text,text) RENAME TO lifecycle_original_manage_member;
ALTER FUNCTION public.workspace_github_credential(uuid) RENAME TO lifecycle_original_github_credential;
CREATE FUNCTION public.workspace_join_invite(invite_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ DECLARE tid uuid; BEGIN
 SELECT team_id INTO tid FROM public.team_invites WHERE code=invite_hash;
 IF tid IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-manage:'||tid::text,0)); END IF;
 IF NOT public.workspace_lifecycle_team_open(tid) THEN RAISE EXCEPTION 'team closed' USING ERRCODE='42501'; END IF;
 RETURN public.lifecycle_original_join_invite(invite_hash);
END $$;
CREATE FUNCTION public.workspace_update_team(wanted_team uuid,new_name text,new_timezone text,new_locale text,expected_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-manage:'||wanted_team::text,0));
 IF NOT public.workspace_lifecycle_team_open(wanted_team) THEN RAISE EXCEPTION 'team closed' USING ERRCODE='42501'; END IF;
 PERFORM public.lifecycle_original_update_team(wanted_team,new_name,new_timezone,new_locale,expected_version);
END $$;
CREATE FUNCTION public.workspace_manage_member(wanted_team uuid,target_user uuid,desired_role text,desired_status text,expected_role text,expected_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-manage:'||wanted_team::text,0));
 IF public.workspace_member_role(wanted_team) IS DISTINCT FROM 'student_lead' THEN RAISE EXCEPTION 'team lead required' USING ERRCODE='42501'; END IF;
 IF (desired_role<>'student_lead' OR desired_status<>'active') AND EXISTS(SELECT 1 FROM public.team_memberships WHERE team_id=wanted_team AND user_id=target_user AND role='student_lead' AND status='active')
 AND NOT EXISTS(SELECT 1 FROM public.team_memberships WHERE team_id=wanted_team AND user_id<>target_user AND role='student_lead' AND status='active' AND public.workspace_lifecycle_account_open(user_id)) THEN RAISE EXCEPTION 'last lead' USING ERRCODE='23514'; END IF;
 PERFORM public.lifecycle_original_manage_member(wanted_team,target_user,desired_role,desired_status,expected_role,expected_status);
END $$;
CREATE FUNCTION public.workspace_github_credential(wanted_connection uuid)
RETURNS TABLE(connection_id uuid,team_id uuid,owner_id uuid,display_name text,locale text,repository text,encrypted_secret text,project_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT * FROM public.lifecycle_original_github_credential(wanted_connection) c WHERE public.workspace_lifecycle_team_open(c.team_id) AND public.workspace_lifecycle_account_open(c.owner_id)
$$;
-- Retired helpers may retain an old runtime ACL after rename: remove all non-owner execute grants.
DO $$ DECLARE signature text; access record; BEGIN
 FOREACH signature IN ARRAY ARRAY['public.lifecycle_original_join_invite(text)','public.lifecycle_original_update_team(uuid,text,text,text,integer)','public.lifecycle_original_manage_member(uuid,uuid,text,text,text,text)','public.lifecycle_original_github_credential(uuid)'] LOOP
  FOR access IN SELECT DISTINCT a.grantee,r.rolname FROM pg_proc p CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a LEFT JOIN pg_roles r ON r.oid=a.grantee WHERE p.oid=signature::regprocedure AND a.grantee<>p.proowner LOOP
   EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM %s',signature,CASE WHEN access.grantee=0 THEN 'PUBLIC' ELSE quote_ident(access.rolname) END);
  END LOOP;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.workspace_lifecycle_account_open(uuid),public.workspace_lifecycle_team_open(uuid),public.workspace_user_id(),public.workspace_member_role(uuid),public.workspace_join_invite(text),public.workspace_update_team(uuid,text,text,text,integer),public.workspace_manage_member(uuid,uuid,text,text,text,text),public.workspace_github_credential(uuid) FROM PUBLIC;

CREATE FUNCTION public.workspace_lifecycle_keys(wanted_team uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(jsonb_agg(key),'[]'::jsonb) FROM(SELECT DISTINCT key FROM(
  SELECT storage_key AS key FROM public.artifacts WHERE team_id=wanted_team
  UNION ALL SELECT metadata->'thumb'->>'storageKey' FROM public.artifacts WHERE team_id=wanted_team
  UNION ALL SELECT jsonb_array_elements_text(storage_keys) FROM public.workspace_uploads WHERE team_id=wanted_team
  UNION ALL SELECT storage_key FROM public.exports WHERE team_id=wanted_team
  UNION ALL SELECT storage_key FROM public.workspace_export_jobs WHERE team_id=wanted_team
  UNION ALL SELECT jsonb_array_elements_text(cleanup_keys) FROM public.workspace_export_jobs WHERE team_id=wanted_team
  UNION ALL SELECT storage_key FROM public.workspace_chat_attachments WHERE team_id=wanted_team
 ) all_keys WHERE key IS NOT NULL AND key<>'') distinct_keys
$$;
CREATE FUNCTION public.workspace_lifecycle_blocking_teams(uid uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name)),'[]'::jsonb)
 FROM public.teams t JOIN public.team_memberships m ON m.team_id=t.id AND m.user_id=uid AND m.role='student_lead' AND m.status='active'
 WHERE public.workspace_lifecycle_team_open(t.id) AND NOT EXISTS(SELECT 1 FROM public.team_memberships other WHERE other.team_id=t.id AND other.user_id<>uid AND other.role='student_lead' AND other.status='active' AND public.workspace_lifecycle_account_open(other.user_id))
$$;
CREATE FUNCTION public.workspace_lifecycle_status() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid:=nullif(current_setting('app.user_id',true),'')::uuid; account_intent public.workspace_lifecycle_requests%ROWTYPE; team_list jsonb;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_verification WHERE user_id=uid AND verified_at IS NOT NULL) THEN RAISE EXCEPTION 'verified account required' USING ERRCODE='42501'; END IF;
 SELECT * INTO account_intent FROM public.workspace_lifecycle_requests WHERE kind='account' AND target_id=uid AND state IN ('pending','purging') ORDER BY requested_at DESC LIMIT 1;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'role',m.role,'state',COALESCE(r.state,'active'),'requestId',r.id,'purgeAfter',r.purge_after,
  'canRequest',m.role='student_lead' AND r.id IS NULL AND public.workspace_lifecycle_account_open(uid),'canCancel',COALESCE(m.role='student_lead' AND r.state='pending' AND r.purge_after>now() AND public.workspace_lifecycle_account_open(uid),false)) ORDER BY t.name),'[]'::jsonb)
 INTO team_list FROM public.teams t JOIN public.team_memberships m ON m.team_id=t.id AND m.user_id=uid AND m.status='active'
 LEFT JOIN public.workspace_lifecycle_requests r ON r.kind='team' AND r.target_id=t.id AND r.state IN ('pending','purging');
 RETURN jsonb_build_object('graceDays',7,'account',jsonb_build_object('state',COALESCE(account_intent.state,'active'),'requestId',account_intent.id,'purgeAfter',account_intent.purge_after,
  'canCancel',COALESCE(account_intent.state='pending' AND account_intent.purge_after>now(),false),'blockingTeams',public.workspace_lifecycle_blocking_teams(uid)),'teams',team_list);
END $$;
CREATE FUNCTION public.workspace_lifecycle_preview(wanted_team uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE keys jsonb; team_name text;
BEGIN
 IF public.workspace_member_role(wanted_team) IS DISTINCT FROM 'student_lead' THEN RAISE EXCEPTION 'lead required' USING ERRCODE='42501'; END IF;
 SELECT name INTO team_name FROM public.teams WHERE id=wanted_team; IF NOT FOUND THEN RAISE EXCEPTION 'team unavailable' USING ERRCODE='42501'; END IF;
 keys:=public.workspace_lifecycle_keys(wanted_team);
 RETURN jsonb_build_object('teamId',wanted_team,'name',team_name,'counts',jsonb_build_object(
  'projects',(SELECT count(*) FROM public.projects WHERE team_id=wanted_team),'records',(SELECT count(*) FROM public.workspace_entity_map WHERE team_id=wanted_team AND entity_type<>'relation'),
  'members',(SELECT count(*) FROM public.team_memberships WHERE team_id=wanted_team),'files',(SELECT count(*) FROM public.artifacts WHERE team_id=wanted_team),
  'reports',(SELECT count(*) FROM public.exports WHERE team_id=wanted_team),'chatMessages',(SELECT count(*) FROM public.workspace_chat_messages WHERE team_id=wanted_team)),
  'fileCount',jsonb_array_length(keys),'knownBytes',(SELECT COALESCE(sum(size_bytes),0) FROM public.artifacts WHERE team_id=wanted_team));
END $$;
CREATE FUNCTION public.workspace_lifecycle_manage(action text,wanted_id uuid,confirmation text,current_session text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid:=nullif(current_setting('app.user_id',true),'')::uuid; item public.workspace_lifecycle_requests%ROWTYPE; expected text; request_key uuid; lock_team uuid;
BEGIN
 IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM public.account_verification WHERE user_id=uid AND verified_at IS NOT NULL) OR NOT EXISTS(SELECT 1 FROM public.sessions WHERE user_id=uid AND id=current_session AND expires_at>now()) THEN RAISE EXCEPTION 'verified session required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle-account:'||uid::text,0));
 IF action='request_team' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-manage:'||wanted_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle-storage:'||wanted_id::text,0));
  IF public.workspace_member_role(wanted_id) IS DISTINCT FROM 'student_lead' THEN RAISE EXCEPTION 'lead required' USING ERRCODE='42501'; END IF;
  SELECT name INTO expected FROM public.teams WHERE id=wanted_id;
  IF trim(confirmation) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'confirmation mismatch' USING ERRCODE='22023'; END IF;
  INSERT INTO public.workspace_lifecycle_requests(kind,target_id,requested_by) VALUES('team',wanted_id,uid) RETURNING id INTO request_key;
  INSERT INTO public.notifications(user_id,kind,title,body,href) SELECT user_id,'lifecycle_team_pending','Team closure scheduled','Workspace access is paused for seven days. A team lead can cancel in Account settings.','/account?lifecycle='||request_key::text FROM public.team_memberships WHERE team_id=wanted_id AND status='active';
 ELSIF action='request_account' THEN
  FOR lock_team IN SELECT team_id FROM public.team_memberships WHERE user_id=uid AND status='active' ORDER BY team_id LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-manage:'||lock_team::text,0));
   PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle-storage:'||lock_team::text,0));
  END LOOP;
  IF wanted_id<>uid OR NOT public.workspace_lifecycle_account_open(uid) THEN RAISE EXCEPTION 'account unavailable' USING ERRCODE='42501'; END IF;
  SELECT email INTO expected FROM public.users WHERE id=uid;
  IF lower(trim(confirmation)) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'confirmation mismatch' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(public.workspace_lifecycle_blocking_teams(uid))>0 THEN RAISE EXCEPTION 'last lead' USING ERRCODE='23514'; END IF;
  INSERT INTO public.workspace_lifecycle_requests(kind,target_id,requested_by) VALUES('account',uid,uid) RETURNING id INTO request_key;
  DELETE FROM public.sessions WHERE user_id=uid AND id<>current_session;
  DELETE FROM public.account_tokens WHERE user_id=uid;
  INSERT INTO public.notifications(user_id,kind,title,body,href) VALUES(uid,'lifecycle_account_pending','Account closure scheduled','Cancel within seven days in Account settings. Team-owned evidence and earlier reports are retained.','/account?lifecycle='||request_key::text);
 ELSIF action IN ('cancel_team','cancel_account') THEN
  SELECT * INTO item FROM public.workspace_lifecycle_requests WHERE id=wanted_id FOR UPDATE;
  IF NOT FOUND OR item.state<>'pending' OR item.purge_after<=now() THEN RAISE EXCEPTION 'closure busy' USING ERRCODE='40001'; END IF;
  IF action='cancel_account' AND (item.kind<>'account' OR item.target_id<>uid) THEN RAISE EXCEPTION 'account unavailable' USING ERRCODE='42501'; END IF;
  IF action='cancel_team' AND (item.kind<>'team' OR NOT public.workspace_lifecycle_account_open(uid) OR NOT EXISTS(SELECT 1 FROM public.team_memberships WHERE team_id=item.target_id AND user_id=uid AND role='student_lead' AND status='active')) THEN RAISE EXCEPTION 'lead required' USING ERRCODE='42501'; END IF;
  UPDATE public.workspace_lifecycle_requests SET state='cancelled',completed_at=now() WHERE id=item.id;
 ELSE RAISE EXCEPTION 'invalid lifecycle action' USING ERRCODE='22023'; END IF;
 RETURN public.workspace_lifecycle_status();
END $$;
REVOKE ALL ON FUNCTION public.workspace_lifecycle_keys(uuid),public.workspace_lifecycle_blocking_teams(uuid),public.workspace_lifecycle_status(),public.workspace_lifecycle_preview(uuid),public.workspace_lifecycle_manage(text,uuid,text,text) FROM PUBLIC;

CREATE FUNCTION public.workspace_lifecycle_claim() RETURNS SETOF public.workspace_lifecycle_requests
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE public.workspace_lifecycle_requests SET state='purging',attempts=attempts+1,claim_token=gen_random_uuid(),lease_until=now()+interval '10 minutes'
 WHERE id IN(SELECT id FROM public.workspace_lifecycle_requests WHERE state IN ('pending','purging') AND purge_after<=now() AND next_attempt_at<=now() AND failures<5 AND (lease_until IS NULL OR lease_until<now()) ORDER BY requested_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *
$$;
CREATE FUNCTION public.workspace_lifecycle_prepare(wanted_request uuid,wanted_claim uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item public.workspace_lifecycle_requests%ROWTYPE; keys jsonb; cleanup_key text; optional_table text; lock_team uuid;
BEGIN
 SELECT * INTO item FROM public.workspace_lifecycle_requests WHERE id=wanted_request AND claim_token=wanted_claim AND state='purging' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND OR item.purge_after>now() THEN RAISE EXCEPTION 'claim unavailable' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.workspace_lifecycle_storage_writes w WHERE (item.kind='team' AND w.team_id=item.target_id) OR (item.kind='account' AND w.user_id=item.target_id)) THEN
  UPDATE public.workspace_lifecycle_requests SET state='pending',claim_token=NULL,lease_until=NULL,next_attempt_at=now()+interval '1 minute',last_error='lifecycle_write_pending' WHERE id=item.id;
  RETURN jsonb_build_object('ready',false,'code','lifecycle_write_pending');
 END IF;
 IF COALESCE((item.summary->>'databasePurged')::boolean,false) THEN RETURN jsonb_build_object('ready',true,'keys',item.cleanup_keys); END IF;
 IF item.kind='team' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle-storage:'||item.target_id::text,0));
  keys:=public.workspace_lifecycle_keys(item.target_id);
 ELSE
  IF jsonb_array_length(public.workspace_lifecycle_blocking_teams(item.target_id))>0 THEN
   UPDATE public.workspace_lifecycle_requests SET state='pending',lease_until=NULL,claim_token=NULL,purge_after=now()+interval '1 day',last_error='lifecycle_last_lead' WHERE id=item.id;
   RETURN jsonb_build_object('ready',false,'code','lifecycle_last_lead');
  END IF;
  FOR lock_team IN SELECT DISTINCT team_id FROM public.workspace_chat_attachments WHERE user_id=item.target_id UNION SELECT team_id FROM public.workspace_uploads WHERE user_id=item.target_id AND artifact_id IS NULL UNION SELECT team_id FROM public.workspace_export_jobs WHERE user_id=item.target_id AND state<>'ready' ORDER BY team_id LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle-storage:'||lock_team::text,0));
  END LOOP;
  SELECT COALESCE(jsonb_agg(key),'[]'::jsonb) INTO keys FROM(SELECT DISTINCT key FROM(
   SELECT storage_key AS key FROM public.workspace_chat_attachments WHERE user_id=item.target_id
   UNION ALL SELECT jsonb_array_elements_text(storage_keys) FROM public.workspace_uploads WHERE user_id=item.target_id AND artifact_id IS NULL
   UNION ALL SELECT j.storage_key FROM public.workspace_export_jobs j JOIN public.exports e ON e.id=j.export_id WHERE j.user_id=item.target_id AND e.status<>'ready'
   UNION ALL SELECT jsonb_array_elements_text(j.cleanup_keys) FROM public.workspace_export_jobs j JOIN public.exports e ON e.id=j.export_id WHERE j.user_id=item.target_id AND e.status<>'ready'
  ) all_keys WHERE key IS NOT NULL AND key<>'') distinct_keys;
 END IF;
 SELECT COALESCE(jsonb_agg(DISTINCT value),'[]'::jsonb) INTO keys FROM jsonb_array_elements_text(keys||item.cleanup_keys||item.all_keys) value;
 IF jsonb_array_length(keys)>50000 THEN RAISE EXCEPTION 'cleanup manifest budget exceeded' USING ERRCODE='22023'; END IF;
 FOR cleanup_key IN SELECT jsonb_array_elements_text(keys) LOOP
  PERFORM public.workspace_lifecycle_key_team(cleanup_key);
  IF item.kind='team' AND public.workspace_lifecycle_key_team(cleanup_key)<>item.target_id THEN RAISE EXCEPTION 'foreign cleanup key' USING ERRCODE='42501'; END IF;
  IF item.kind='account' AND NOT EXISTS(
   SELECT 1 FROM public.workspace_chat_attachments a WHERE a.user_id=item.target_id AND a.storage_key=cleanup_key AND a.team_id=public.workspace_lifecycle_key_team(cleanup_key)
   UNION ALL SELECT 1 FROM public.workspace_uploads u WHERE u.user_id=item.target_id AND u.artifact_id IS NULL AND u.storage_keys ? cleanup_key AND u.team_id=public.workspace_lifecycle_key_team(cleanup_key)
   UNION ALL SELECT 1 FROM public.workspace_export_jobs j JOIN public.exports e ON e.id=j.export_id WHERE j.user_id=item.target_id AND e.status<>'ready' AND (j.storage_key=cleanup_key OR j.cleanup_keys ? cleanup_key) AND j.team_id=public.workspace_lifecycle_key_team(cleanup_key)
  ) THEN RAISE EXCEPTION 'foreign cleanup key' USING ERRCODE='42501'; END IF;
 END LOOP;
 -- This durable key list commits in the same transaction as DB erasure. Storage is touched only afterwards.
 UPDATE public.workspace_lifecycle_requests SET cleanup_keys=keys,all_keys=keys WHERE id=item.id;
 IF item.kind='team' THEN
  DELETE FROM public.annotations WHERE team_id=item.target_id;
  DELETE FROM public.relations WHERE team_id=item.target_id;
  DELETE FROM public.robot_models WHERE team_id=item.target_id;
  DELETE FROM public.artifacts WHERE team_id=item.target_id;
  DELETE FROM public.source_events WHERE team_id=item.target_id;
  DELETE FROM public.notifications WHERE team_id=item.target_id OR href='/account?lifecycle='||item.id::text;
  DELETE FROM public.audit_events WHERE team_id=item.target_id;
  DELETE FROM public.analytics_events WHERE team_id=item.target_id;
  DELETE FROM public.jobs WHERE payload->>'teamId'=item.target_id::text;
  FOREACH optional_table IN ARRAY ARRAY['product_reviews','product_usage_days'] LOOP
   IF to_regclass('public.'||optional_table) IS NOT NULL THEN EXECUTE format('DELETE FROM public.%I WHERE team_id=$1',optional_table) USING item.target_id; END IF;
  END LOOP;
  DELETE FROM public.teams WHERE id=item.target_id;
 ELSE
  DELETE FROM public.workspace_chat_messages WHERE user_id=item.target_id;
  DELETE FROM public.workspace_chat_attachments WHERE user_id=item.target_id;
  DELETE FROM public.workspace_uploads WHERE user_id=item.target_id AND artifact_id IS NULL;
  DELETE FROM public.exports WHERE created_by=item.target_id AND status<>'ready';
  DELETE FROM public.workspace_requests WHERE user_id=item.target_id;
  DELETE FROM public.workspace_call_signals WHERE from_participant_id IN(SELECT id FROM public.workspace_call_participants WHERE user_id=item.target_id) OR to_participant_id IN(SELECT id FROM public.workspace_call_participants WHERE user_id=item.target_id);
  DELETE FROM public.workspace_call_participants WHERE user_id=item.target_id;
  DELETE FROM public.notifications WHERE user_id=item.target_id;
  DELETE FROM public.analytics_events WHERE user_id=item.target_id;
  FOREACH optional_table IN ARRAY ARRAY['product_reviews','product_usage_days'] LOOP
   IF to_regclass('public.'||optional_table) IS NOT NULL THEN EXECUTE format('DELETE FROM public.%I WHERE user_id=$1',optional_table) USING item.target_id; END IF;
  END LOOP;
  DELETE FROM public.sessions WHERE user_id=item.target_id;
  DELETE FROM public.account_tokens WHERE user_id=item.target_id;
  DELETE FROM public.account_mail_outbox WHERE user_id=item.target_id;
  DELETE FROM public.account_verification WHERE user_id=item.target_id;
  DELETE FROM public.organization_memberships WHERE user_id=item.target_id;
  UPDATE public.team_memberships SET status='removed',left_at=now() WHERE user_id=item.target_id;
  UPDATE public.users SET email='closed-'||id::text||'@accounts.invalid',password_hash='closed$'||gen_random_uuid()::text,display_name='Closed account',locale='en',age_category='unspecified',settings='{}'::jsonb,platform_role='user' WHERE id=item.target_id;
 END IF;
 UPDATE public.workspace_lifecycle_requests SET summary=jsonb_build_object('databasePurged',true,'initialObjectCount',jsonb_array_length(keys)) WHERE id=item.id;
 RETURN jsonb_build_object('ready',true,'keys',keys);
END $$;
CREATE FUNCTION public.workspace_lifecycle_ack(wanted_request uuid,wanted_claim uuid,removed_keys jsonb,error_code text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE item public.workspace_lifecycle_requests%ROWTYPE; remaining jsonb;
BEGIN
 SELECT * INTO item FROM public.workspace_lifecycle_requests WHERE id=wanted_request AND claim_token=wanted_claim AND state='purging' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'claim unavailable' USING ERRCODE='42501'; END IF;
 IF error_code IS NOT NULL AND error_code NOT IN ('storage_cleanup_failed','lifecycle_prepare_failed') THEN RAISE EXCEPTION 'invalid failure code' USING ERRCODE='22023'; END IF;
 IF removed_keys IS NULL OR jsonb_typeof(removed_keys)<>'array' OR jsonb_array_length(removed_keys)>100 THEN RAISE EXCEPTION 'invalid cleanup receipt' USING ERRCODE='22023'; END IF;
 IF NOT COALESCE((item.summary->>'databasePurged')::boolean,false) AND jsonb_array_length(removed_keys)>0 THEN RAISE EXCEPTION 'DB erasure not committed' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(removed_keys) key WHERE NOT item.cleanup_keys ? key) THEN RAISE EXCEPTION 'unrecorded cleanup key' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(jsonb_agg(key),'[]'::jsonb) INTO remaining FROM jsonb_array_elements_text(item.cleanup_keys) key WHERE NOT removed_keys ? key;
 UPDATE public.workspace_lifecycle_requests SET cleanup_keys=remaining,lease_until=NULL,claim_token=NULL,
  failures=CASE WHEN error_code IS NULL OR jsonb_array_length(removed_keys)>0 THEN 0 ELSE failures+1 END,last_error=error_code,
  next_attempt_at=now()+interval '1 minute',state=CASE WHEN COALESCE((summary->>'databasePurged')::boolean,false) AND jsonb_array_length(remaining)=0 THEN 'purged' ELSE 'purging' END,
  completed_at=CASE WHEN COALESCE((summary->>'databasePurged')::boolean,false) AND jsonb_array_length(remaining)=0 THEN now() ELSE NULL END WHERE id=item.id;
 RETURN jsonb_build_object('purged',COALESCE((item.summary->>'databasePurged')::boolean,false) AND jsonb_array_length(remaining)=0,'remaining',jsonb_array_length(remaining));
END $$;
REVOKE ALL ON FUNCTION public.workspace_lifecycle_claim(),public.workspace_lifecycle_prepare(uuid,uuid),public.workspace_lifecycle_ack(uuid,uuid,jsonb,text) FROM PUBLIC;

CREATE FUNCTION public.workspace_lifecycle_late_key(object_key text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE team_uuid uuid;
BEGIN
 team_uuid:=public.workspace_lifecycle_key_team(object_key);
 UPDATE public.workspace_lifecycle_requests SET cleanup_keys=CASE WHEN cleanup_keys ? object_key THEN cleanup_keys ELSE cleanup_keys||jsonb_build_array(object_key) END,
  all_keys=CASE WHEN all_keys ? object_key THEN all_keys ELSE all_keys||jsonb_build_array(object_key) END,
  state=CASE WHEN state='purged' THEN 'purging' ELSE state END,next_attempt_at=now(),completed_at=NULL,failures=0,claim_token=NULL,lease_until=NULL
 WHERE id IN(SELECT r.id FROM public.workspace_lifecycle_requests r WHERE r.state IN ('pending','purging','purged') AND (
  (r.kind='team' AND r.target_id=team_uuid) OR (r.kind='account' AND (r.all_keys ? object_key OR
   EXISTS(SELECT 1 FROM public.workspace_chat_attachments a WHERE a.user_id=r.target_id AND a.team_id=team_uuid AND a.storage_key=object_key) OR
   EXISTS(SELECT 1 FROM public.workspace_uploads u WHERE u.user_id=r.target_id AND u.team_id=team_uuid AND u.artifact_id IS NULL AND u.storage_keys ? object_key) OR
   EXISTS(SELECT 1 FROM public.workspace_export_jobs j WHERE j.user_id=r.target_id AND j.team_id=team_uuid AND j.state<>'ready' AND (j.storage_key=object_key OR j.cleanup_keys ? object_key))
  ))));
END $$;
REVOKE ALL ON FUNCTION public.workspace_lifecycle_late_key(text) FROM PUBLIC;

CREATE FUNCTION public.workspace_lifecycle_storage_open(object_key text,writing boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT public.workspace_lifecycle_team_open(public.workspace_lifecycle_key_team(object_key)) AND (NOT writing OR (
  NOT EXISTS(SELECT 1 FROM public.workspace_uploads u WHERE u.storage_keys ? object_key AND NOT public.workspace_lifecycle_account_open(u.user_id)) AND
  NOT EXISTS(SELECT 1 FROM public.workspace_chat_attachments a WHERE a.storage_key=object_key AND NOT public.workspace_lifecycle_account_open(a.user_id)) AND
  NOT EXISTS(SELECT 1 FROM public.workspace_export_jobs j WHERE (j.storage_key=object_key OR j.cleanup_keys ? object_key) AND NOT public.workspace_lifecycle_account_open(j.user_id))
 ))
$$;
REVOKE ALL ON FUNCTION public.workspace_lifecycle_storage_open(text,boolean) FROM PUBLIC;
CREATE FUNCTION public.workspace_lifecycle_begin_write(object_key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE tid uuid:=public.workspace_lifecycle_key_team(object_key); uid uuid; writer uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle-storage:'||tid::text,0));
 IF NOT public.workspace_lifecycle_storage_open(object_key,true) THEN RAISE EXCEPTION 'lifecycle_storage_closed' USING ERRCODE='42501'; END IF;
 SELECT user_id INTO uid FROM(
  SELECT user_id FROM public.workspace_uploads WHERE team_id=tid AND storage_keys ? object_key
  UNION SELECT user_id FROM public.workspace_chat_attachments WHERE team_id=tid AND storage_key=object_key
  UNION SELECT user_id FROM public.workspace_export_jobs WHERE team_id=tid AND (storage_key=object_key OR cleanup_keys ? object_key)
 ) owner LIMIT 1;
 IF uid IS NULL THEN RAISE EXCEPTION 'storage reservation required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.workspace_lifecycle_storage_writes(team_id,user_id,key) VALUES(tid,uid,object_key) RETURNING id INTO writer;
 RETURN writer;
END $$;
CREATE FUNCTION public.workspace_lifecycle_finish_write(wanted_writer uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE writer public.workspace_lifecycle_storage_writes%ROWTYPE; allowed boolean;
BEGIN
 SELECT * INTO writer FROM public.workspace_lifecycle_storage_writes WHERE id=wanted_writer FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'writer unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('lifecycle-storage:'||writer.team_id::text,0));
 allowed:=public.workspace_lifecycle_storage_open(writer.key,true);
 IF NOT allowed THEN PERFORM public.workspace_lifecycle_late_key(writer.key); END IF;
 DELETE FROM public.workspace_lifecycle_storage_writes WHERE id=writer.id;
 RETURN allowed;
END $$;
REVOKE ALL ON FUNCTION public.workspace_lifecycle_begin_write(text),public.workspace_lifecycle_finish_write(uuid) FROM PUBLIC;
CREATE FUNCTION public.workspace_lifecycle_blocked_count() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT count(*) FROM public.workspace_lifecycle_requests WHERE state='purging' AND failures>=5
$$;
REVOKE ALL ON FUNCTION public.workspace_lifecycle_blocked_count() FROM PUBLIC;
