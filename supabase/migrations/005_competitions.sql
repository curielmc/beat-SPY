-- Migration 005: Competitions
-- Time-bound investing challenges with sponsors, rules, benchmarks, prizes

-- Extend portfolios owner_type to include 'competition'
ALTER TABLE portfolios DROP CONSTRAINT portfolios_owner_type_check;
ALTER TABLE portfolios ADD CONSTRAINT portfolios_owner_type_check
  CHECK (owner_type IN ('group', 'user', 'competition'));

-- Competitions table
CREATE TABLE competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  sponsor text,
  sponsor_logo_url text,
  benchmark_ticker text NOT NULL DEFAULT 'SPY',
  starting_cash numeric NOT NULL DEFAULT 100000,
  registration_open timestamptz,
  registration_close timestamptz,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'active', 'completed', 'cancelled')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  prizes jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_public boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_competitions_status ON competitions(status);
CREATE INDEX idx_competitions_is_public ON competitions(is_public);

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

-- Public competitions readable by anyone
CREATE POLICY "Public competitions are readable" ON competitions
  FOR SELECT USING (is_public = true OR created_by = auth.uid() OR is_admin());

-- Only admins can create/update/delete competitions
CREATE POLICY "Admins can manage competitions" ON competitions
  FOR ALL USING (is_admin());

-- Competition entries table
CREATE TABLE competition_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  thesis text,
  registered_at timestamptz DEFAULT now(),
  final_rank integer,
  final_return_pct numeric,
  UNIQUE(competition_id, user_id)
);

CREATE INDEX idx_competition_entries_competition ON competition_entries(competition_id);
CREATE INDEX idx_competition_entries_user ON competition_entries(user_id);

ALTER TABLE competition_entries ENABLE ROW LEVEL SECURITY;

-- Entries readable by participant + admins + anyone for public competitions
CREATE POLICY "Competition entries are readable" ON competition_entries
  FOR SELECT USING (
    user_id = auth.uid() OR
    is_admin() OR
    EXISTS (
      SELECT 1 FROM competitions c
      WHERE c.id = competition_entries.competition_id AND c.is_public = true
    )
  );

-- Users can insert their own entries
CREATE POLICY "Users can register for competitions" ON competition_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can update entries (for finalizing results)
CREATE POLICY "Admins can manage entries" ON competition_entries
  FOR ALL USING (is_admin());

-- Competition portfolios should be readable when competition is public
-- (already handled by existing portfolio RLS if is_public = true on the portfolio)
