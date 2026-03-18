ALTER TABLE training_tutorials
  ADD COLUMN IF NOT EXISTS source_type text CHECK (source_type IN ('pdf', 'pptx', 'google-drive', 'google-slides', 'text', 'url')),
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS deck_pdf_url text,
  ADD COLUMN IF NOT EXISTS generated_by text NOT NULL DEFAULT 'manual' CHECK (generated_by IN ('manual', 'jasper')),
  ADD COLUMN IF NOT EXISTS jasper_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS jasper_api_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  owner_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jasper_api_tokens_owner_user_id ON jasper_api_tokens(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_jasper_api_tokens_token_hash ON jasper_api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_training_tutorials_generated_by ON training_tutorials(generated_by);

ALTER TABLE jasper_api_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can read Jasper tokens" ON jasper_api_tokens;
  CREATE POLICY "Admins can read Jasper tokens"
    ON jasper_api_tokens
    FOR SELECT
    USING (is_admin());

  DROP POLICY IF EXISTS "Admins can manage Jasper tokens" ON jasper_api_tokens;
  CREATE POLICY "Admins can manage Jasper tokens"
    ON jasper_api_tokens
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());
END $$;
