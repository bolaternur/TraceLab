-- Additive recovery metadata; 0009 is kept byte-identical to its applied version.
ALTER TABLE workspace_export_jobs ADD COLUMN cleanup_keys jsonb NOT NULL DEFAULT '[]'::jsonb;
