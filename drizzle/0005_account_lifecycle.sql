-- Legacy users remain unverified until they complete the resend/verify flow.
CREATE TABLE account_verification (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE account_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  next_path text NOT NULL DEFAULT '/workspace/',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX account_tokens_user_purpose_idx ON account_tokens(user_id, purpose);
CREATE INDEX account_tokens_expiry_idx ON account_tokens(expires_at);
--> statement-breakpoint
CREATE TABLE account_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0)
);
CREATE INDEX account_rate_limits_window_idx ON account_rate_limits(window_started_at);
--> statement-breakpoint
CREATE TABLE account_mail_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload_ciphertext text NOT NULL,
  preview_key_hash text,
  transport text NOT NULL CHECK (transport IN ('local', 'production')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'preview', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 3),
  last_error text,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX account_mail_pending_idx ON account_mail_outbox(status, next_attempt_at);
CREATE INDEX account_mail_preview_idx ON account_mail_outbox(preview_key_hash, created_at);
