-- Add a bounded durable receipt queue to the existing source connection model.
CREATE TABLE workspace_source_receipts (
  connection_id uuid NOT NULL REFERENCES source_connections(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL,
  payload_hash text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','complete','failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  imported_count integer NOT NULL DEFAULT 0,
  last_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  PRIMARY KEY(connection_id,delivery_id)
);
--> statement-breakpoint
ALTER TABLE workspace_source_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_sources_receipt_read ON workspace_source_receipts FOR SELECT
 USING (public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY workspace_sources_receipt_write ON workspace_source_receipts FOR INSERT
 WITH CHECK (public.workspace_member_role(team_id) IN ('student','student_lead'));
CREATE POLICY workspace_sources_receipt_update ON workspace_source_receipts FOR UPDATE
 USING (public.workspace_member_role(team_id) IN ('student','student_lead'))
 WITH CHECK (public.workspace_member_role(team_id) IN ('student','student_lead'));
--> statement-breakpoint
-- The unauthenticated webhook can only locate one eligible credential. It cannot
-- enumerate connections or mutate state. Application verifies HMAC before any write.
CREATE FUNCTION public.workspace_github_credential(wanted_connection uuid)
RETURNS TABLE(connection_id uuid, team_id uuid, owner_id uuid, display_name text, locale text, repository text, encrypted_secret text, project_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT c.id,c.team_id,c.created_by,u.display_name,u.locale,c.external_id,c.encrypted_secret,(c.config->>'workspaceProjectId')::uuid
 FROM public.source_connections c
 JOIN public.users u ON u.id=c.created_by
 JOIN public.account_verification v ON v.user_id=u.id AND v.verified_at IS NOT NULL
 JOIN public.team_memberships m ON m.user_id=u.id AND m.team_id=c.team_id AND m.status='active' AND m.role IN ('student','student_lead')
 WHERE c.id=wanted_connection AND c.provider='github' AND c.status IN ('pending','receiving','error')
 AND c.encrypted_secret IS NOT NULL AND c.config->>'workspaceMode'='repository-webhook'
$$;
REVOKE ALL ON FUNCTION public.workspace_github_credential(uuid) FROM PUBLIC;
--> statement-breakpoint
-- All SECURITY DEFINER helpers are available only to the runtime role explicitly
-- granted by the trusted migration runner; no public/default execute permission.
REVOKE ALL ON FUNCTION public.workspace_member_role(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.workspace_create_team(text,text,text,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.workspace_join_invite(text) FROM PUBLIC;
