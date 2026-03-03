-- Add visibility to portfolios
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'group', 'public'));
ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS share_holdings BOOLEAN DEFAULT FALSE;

-- Set existing personal portfolios to private
UPDATE portfolios SET visibility = 'private' WHERE owner_type = 'user' AND visibility IS NULL;

-- Set existing group portfolios: returns visible to group by default
UPDATE portfolios SET visibility = 'group' WHERE owner_type = 'group' AND visibility IS NULL;

-- Add class-level fund settings
ALTER TABLE classes ADD COLUMN IF NOT EXISTS max_funds INTEGER DEFAULT 10;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS default_fund_cash NUMERIC DEFAULT 100000;

-- Teacher action: open new fund for entire class
CREATE OR REPLACE FUNCTION open_class_fund(p_class_id UUID, p_fund_name TEXT, p_thesis TEXT DEFAULT NULL, p_starting_cash NUMERIC DEFAULT 100000)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_group RECORD;
  v_fund_count INTEGER;
BEGIN
  -- Verify caller is teacher of this class
  IF NOT EXISTS (
    SELECT 1 FROM classes WHERE id = p_class_id AND teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- For each group in the class, create a new portfolio
  FOR v_group IN SELECT id FROM groups WHERE class_id = p_class_id LOOP
    SELECT COUNT(*) INTO v_fund_count FROM portfolios
    WHERE owner_type = 'group' AND owner_id = v_group.id;

    INSERT INTO portfolios (owner_type, owner_id, cash_balance, starting_cash, fund_starting_cash, fund_name, fund_thesis, fund_number, status, visibility)
    VALUES ('group', v_group.id, p_starting_cash, p_starting_cash, p_starting_cash, p_fund_name, p_thesis, v_fund_count + 1, 'active', 'group');
  END LOOP;
END;
$$;
