-- Migration 004: Custom Baskets
-- Users can create their own stock baskets and share them publicly

CREATE TABLE custom_baskets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  tickers text[] NOT NULL DEFAULT '{}',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_custom_baskets_user_id ON custom_baskets(user_id);
CREATE INDEX idx_custom_baskets_is_public ON custom_baskets(is_public);

ALTER TABLE custom_baskets ENABLE ROW LEVEL SECURITY;

-- Owner can do everything
CREATE POLICY "Users can manage own baskets" ON custom_baskets
  FOR ALL USING (user_id = auth.uid() OR is_admin());

-- Anyone can read public baskets
CREATE POLICY "Public baskets are readable by anyone" ON custom_baskets
  FOR SELECT USING (is_public = true);
