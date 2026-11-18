-- Team conversation is separate from immutable engineering evidence.
CREATE TABLE workspace_chat_attachments (
  id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_id uuid NOT NULL,
  kind text NOT NULL CHECK(kind IN ('photo','voice')), mime_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK(size_bytes>0 AND size_bytes<=15728640),
  duration_ms integer CHECK(duration_ms BETWEEN 1 AND 300000),
  storage_key text NOT NULL, sha256 text NOT NULL, payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'staging' CHECK(status IN ('staging','ready','attached','failed')),
  created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes',
  UNIQUE(user_id,request_id), UNIQUE(team_id,id)
);
--> statement-breakpoint
CREATE TABLE workspace_chat_messages (
  id uuid PRIMARY KEY, sequence bigserial UNIQUE NOT NULL,
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_id uuid NOT NULL,
  body text NOT NULL CHECK(length(body)<=4000),
  attachment_id uuid UNIQUE REFERENCES workspace_chat_attachments(id),
  payload_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(length(trim(body))>0 OR attachment_id IS NOT NULL), UNIQUE(user_id,request_id),
  FOREIGN KEY(team_id,attachment_id) REFERENCES workspace_chat_attachments(team_id,id)
);
CREATE INDEX workspace_chat_messages_team_sequence ON workspace_chat_messages(team_id,sequence DESC);
--> statement-breakpoint
CREATE TABLE workspace_chat_rate_limits (
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL, window_start timestamptz NOT NULL DEFAULT now(), hits integer NOT NULL DEFAULT 1,
  PRIMARY KEY(team_id,user_id,kind)
);
--> statement-breakpoint
CREATE TABLE workspace_call_participants (
  id uuid PRIMARY KEY, team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '45 seconds', UNIQUE(team_id,id)
);
CREATE INDEX workspace_call_participants_active ON workspace_call_participants(team_id,expires_at);
--> statement-breakpoint
CREATE TABLE workspace_call_signals (
  sequence bigserial PRIMARY KEY, team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  from_participant_id uuid NOT NULL REFERENCES workspace_call_participants(id) ON DELETE CASCADE,
  to_participant_id uuid NOT NULL REFERENCES workspace_call_participants(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK(kind IN ('offer','answer','ice')),
  payload jsonb NOT NULL CHECK(pg_column_size(payload)<=60000), created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(team_id,from_participant_id) REFERENCES workspace_call_participants(team_id,id) ON DELETE CASCADE,
  FOREIGN KEY(team_id,to_participant_id) REFERENCES workspace_call_participants(team_id,id) ON DELETE CASCADE
);
CREATE INDEX workspace_call_signals_recipient ON workspace_call_signals(team_id,to_participant_id,sequence);
--> statement-breakpoint
ALTER TABLE workspace_chat_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_attachment_read ON workspace_chat_attachments FOR SELECT USING(public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY chat_attachment_insert ON workspace_chat_attachments FOR INSERT WITH CHECK(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY chat_attachment_update ON workspace_chat_attachments FOR UPDATE USING(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL) WITH CHECK(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL);
ALTER TABLE workspace_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_message_read ON workspace_chat_messages FOR SELECT USING(public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY chat_message_insert ON workspace_chat_messages FOR INSERT WITH CHECK(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL);
ALTER TABLE workspace_chat_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY chat_rate_own ON workspace_chat_rate_limits FOR ALL USING(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL) WITH CHECK(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL);
ALTER TABLE workspace_call_participants ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_participant_read ON workspace_call_participants FOR SELECT USING(public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY call_participant_write ON workspace_call_participants FOR INSERT WITH CHECK(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY call_participant_update ON workspace_call_participants FOR UPDATE USING(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL) WITH CHECK(user_id=public.workspace_user_id() AND public.workspace_member_role(team_id) IS NOT NULL);
CREATE POLICY call_participant_cleanup ON workspace_call_participants FOR DELETE USING(public.workspace_member_role(team_id) IS NOT NULL AND expires_at<now()-interval '2 minutes');
ALTER TABLE workspace_call_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY call_signal_read ON workspace_call_signals FOR SELECT USING(public.workspace_member_role(team_id) IS NOT NULL AND EXISTS(SELECT 1 FROM workspace_call_participants p WHERE p.id IN (to_participant_id,from_participant_id) AND p.team_id=workspace_call_signals.team_id AND p.user_id=public.workspace_user_id() AND p.expires_at>now()));
CREATE POLICY call_signal_insert ON workspace_call_signals FOR INSERT WITH CHECK(public.workspace_member_role(team_id) IS NOT NULL AND EXISTS(SELECT 1 FROM workspace_call_participants p WHERE p.id=from_participant_id AND p.team_id=workspace_call_signals.team_id AND p.user_id=public.workspace_user_id() AND p.expires_at>now()));
CREATE POLICY call_signal_cleanup ON workspace_call_signals FOR DELETE USING(public.workspace_member_role(team_id) IS NOT NULL AND created_at<now()-interval '2 minutes');
