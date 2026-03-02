-- Add fund metadata columns to portfolios table
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS fund_name TEXT;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS fund_thesis TEXT;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS fund_number INTEGER DEFAULT 1;
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS fund_starting_cash NUMERIC DEFAULT 100000;

-- Update existing portfolios to have fund_number = 1
UPDATE portfolios SET fund_number = 1 WHERE fund_number IS NULL;

-- RLS: students can create new funds for themselves (owner_type=user, owner_id=auth.uid())
-- Already covered by existing portfolio RLS policies
