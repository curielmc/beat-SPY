-- Add lifecycle fields to portfolios
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'closed'));
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS reset_count integer DEFAULT 0;

-- Portfolio snapshots: captures state at reset or close time
CREATE TABLE portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('reset', 'close')),
  cash_balance numeric NOT NULL,
  starting_cash numeric NOT NULL,
  total_value numeric NOT NULL,
  return_pct numeric NOT NULL,
  holdings jsonb DEFAULT '[]'::jsonb,
  snapshotted_at timestamptz DEFAULT now(),
  label text
);

ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own snapshots" ON portfolio_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM portfolios p WHERE p.id = portfolio_id AND p.owner_id = auth.uid())
  );
CREATE POLICY "Users can insert own snapshots" ON portfolio_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM portfolios p WHERE p.id = portfolio_id AND p.owner_id = auth.uid())
  );
