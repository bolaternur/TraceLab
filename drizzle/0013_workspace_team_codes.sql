ALTER TABLE team_invites ADD COLUMN kind text NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual','team_code'));
--> statement-breakpoint
ALTER POLICY workspace_invites_read ON team_invites USING (public.workspace_member_role(team_id)='student_lead');
ALTER POLICY workspace_invites_insert ON team_invites WITH CHECK
  (public.workspace_member_role(team_id)='student_lead' AND role='student' AND created_by=public.workspace_user_id()
   AND max_uses BETWEEN 1 AND 200 AND uses=0 AND expires_at>now() AND expires_at<=now()+interval '31 days'
   AND (kind='individual' OR (kind='team_code' AND email IS NULL AND max_uses>=2)));
ALTER POLICY workspace_invites_revoke ON team_invites
  USING (public.workspace_member_role(team_id)='student_lead')
  WITH CHECK (role='student' AND public.workspace_member_role(team_id)='student_lead');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.workspace_join_invite(invite_hash text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid:=public.workspace_user_id(); invitation public.team_invites%ROWTYPE; account_email text;
BEGIN
  SELECT u.email INTO account_email FROM public.users u JOIN public.account_verification av ON av.user_id=u.id
    WHERE u.id=uid AND av.verified_at IS NOT NULL;
  IF account_email IS NULL THEN RAISE EXCEPTION 'verified account required' USING ERRCODE='42501'; END IF;
  SELECT * INTO invitation FROM public.team_invites WHERE code=invite_hash FOR UPDATE;
  IF NOT FOUND OR invitation.revoked_at IS NOT NULL OR invitation.expires_at<=now() OR invitation.role<>'student'
    OR (invitation.email IS NOT NULL AND lower(invitation.email)<>lower(account_email)) THEN
    RAISE EXCEPTION 'invite unavailable' USING ERRCODE='42501';
  END IF;
  -- Serialize separate codes for the same team/user as well as this code's quota.
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace-join:'||invitation.team_id::text||':'||uid::text,0));
  IF EXISTS(SELECT 1 FROM public.team_memberships WHERE team_id=invitation.team_id AND user_id=uid) THEN
    IF EXISTS(SELECT 1 FROM public.team_memberships WHERE team_id=invitation.team_id AND user_id=uid AND status='active') THEN
      RETURN invitation.team_id;
    END IF;
    RAISE EXCEPTION 'membership requires review' USING ERRCODE='42501';
  END IF;
  IF invitation.uses>=invitation.max_uses THEN RAISE EXCEPTION 'invite unavailable' USING ERRCODE='42501'; END IF;
  INSERT INTO public.team_memberships(team_id,user_id,role) VALUES(invitation.team_id,uid,'student');
  UPDATE public.team_invites SET uses=uses+1 WHERE id=invitation.id;
  INSERT INTO public.audit_events(team_id,actor_user_id,action,entity_type,entity_id,metadata)
    VALUES(invitation.team_id,uid,'team.invite.accepted','team_invite',invitation.id,jsonb_build_object('kind',invitation.kind,'role','student'));
  RETURN invitation.team_id;
END $$;
REVOKE ALL ON FUNCTION public.workspace_join_invite(text) FROM PUBLIC;
