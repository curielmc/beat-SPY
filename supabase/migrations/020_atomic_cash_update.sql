-- Atomic cash balance update to prevent race conditions
-- when multiple group members trade simultaneously.
-- Uses increment/decrement instead of read-then-write.

CREATE OR REPLACE FUNCTION adjust_cash_balance(p_portfolio_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance numeric;
BEGIN
  UPDATE portfolios
  SET cash_balance = cash_balance + p_delta
  WHERE id = p_portfolio_id
  RETURNING cash_balance INTO new_balance;

  RETURN new_balance;
END;
$$;
