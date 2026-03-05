-- Create table for S&P 500 constituents
CREATE TABLE IF NOT EXISTS sp500_constituents (
  symbol text PRIMARY KEY,
  name text,
  sector text,
  sub_sector text,
  added_at timestamptz DEFAULT now()
);

-- RLS: anyone can read
ALTER TABLE sp500_constituents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read S&P 500 constituents" ON sp500_constituents
  FOR SELECT USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sp500_constituents_symbol ON sp500_constituents(symbol);
