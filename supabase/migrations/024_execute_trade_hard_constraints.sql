-- Execute trades server-side with hard constraints enforced in DB.
-- This makes approval code, rationale, and trade-frequency rules non-bypassable.

CREATE OR REPLACE FUNCTION execute_trade(
  p_portfolio_id uuid,
  p_ticker text,
  p_side text,
  p_dollars numeric,
  p_price numeric,
  p_rationale text DEFAULT NULL,
  p_approval_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_portfolio portfolios%ROWTYPE;
  v_group groups%ROWTYPE;
  v_class classes%ROWTYPE;
  v_restrictions jsonb;
  v_fund_restrictions jsonb;
  v_freq text;
  v_window_start timestamptz;
  v_existing_holding holdings%ROWTYPE;
  v_shares numeric;
  v_new_shares numeric;
  v_ticker text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'Invalid trade side';
  END IF;
  IF p_dollars IS NULL OR p_dollars <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;
  IF p_price IS NULL OR p_price <= 0 THEN
    RAISE EXCEPTION 'Invalid execution price';
  END IF;

  v_ticker := UPPER(TRIM(p_ticker));
  IF v_ticker = '' THEN
    RAISE EXCEPTION 'Ticker is required';
  END IF;

  -- Lock the portfolio row to prevent concurrent balance races.
  SELECT *
  INTO v_portfolio
  FROM portfolios
  WHERE id = p_portfolio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found';
  END IF;

  -- Authorization: user portfolios only by owner; group portfolios by group members.
  IF v_portfolio.owner_type = 'user' THEN
    IF v_portfolio.owner_id <> v_uid THEN
      RAISE EXCEPTION 'Not authorized for this portfolio';
    END IF;
  ELSIF v_portfolio.owner_type = 'group' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM class_memberships cm
      WHERE cm.group_id = v_portfolio.owner_id
        AND cm.user_id = v_uid
    ) THEN
      RAISE EXCEPTION 'Not authorized for this group portfolio';
    END IF;

    -- Load class restrictions for group trades.
    SELECT *
    INTO v_group
    FROM groups
    WHERE id = v_portfolio.owner_id;

    IF FOUND THEN
      SELECT *
      INTO v_class
      FROM classes
      WHERE id = v_group.class_id;
    END IF;

    v_restrictions := COALESCE(v_class.restrictions, '{}'::jsonb);
    v_fund_restrictions := COALESCE(
      v_restrictions -> 'byFund' -> COALESCE(v_portfolio.fund_number::text, '1'),
      v_restrictions
    );

    -- Approval code hard enforcement.
    IF COALESCE(v_class.approval_code, '') <> '' THEN
      IF COALESCE(TRIM(p_approval_code), '') <> v_class.approval_code THEN
        RAISE EXCEPTION 'Invalid approval code';
      END IF;
    END IF;

    -- Rationale hard enforcement (default required unless explicitly false).
    IF COALESCE((v_fund_restrictions ->> 'requireRationale')::boolean, true) = true THEN
      IF COALESCE(TRIM(p_rationale), '') = '' THEN
        RAISE EXCEPTION 'Please explain your reasoning before trading';
      END IF;
    END IF;

    -- Trade-frequency hard enforcement.
    v_freq := COALESCE(v_fund_restrictions ->> 'tradeFrequency', 'unlimited');
    IF v_freq <> 'unlimited' THEN
      IF v_freq = 'once_per_day' THEN
        v_window_start := date_trunc('day', now());
      ELSIF v_freq = 'once_per_week' THEN
        v_window_start := now() - interval '7 days';
      ELSIF v_freq = 'once_per_month' THEN
        v_window_start := now() - interval '1 month';
      ELSE
        v_window_start := NULL;
      END IF;

      IF v_window_start IS NOT NULL AND EXISTS (
        SELECT 1
        FROM trades t
        WHERE t.portfolio_id = p_portfolio_id
          AND UPPER(t.ticker) = v_ticker
          AND t.executed_at >= v_window_start
        LIMIT 1
      ) THEN
        RAISE EXCEPTION 'You can only trade % %', v_ticker, replace(v_freq, '_', ' ');
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported portfolio owner type';
  END IF;

  v_shares := p_dollars / p_price;

  -- Lock existing holding row if present.
  SELECT *
  INTO v_existing_holding
  FROM holdings
  WHERE portfolio_id = p_portfolio_id
    AND UPPER(ticker) = v_ticker
  FOR UPDATE;

  IF p_side = 'buy' THEN
    IF v_portfolio.cash_balance < p_dollars THEN
      RAISE EXCEPTION 'Insufficient cash';
    END IF;

    INSERT INTO trades (portfolio_id, user_id, ticker, side, dollars, shares, price, rationale)
    VALUES (p_portfolio_id, v_uid, v_ticker, 'buy', p_dollars, v_shares, p_price, NULLIF(TRIM(p_rationale), ''));

    IF FOUND THEN
      NULL;
    END IF;

    IF v_existing_holding.id IS NOT NULL THEN
      v_new_shares := v_existing_holding.shares + v_shares;
      UPDATE holdings
      SET
        shares = v_new_shares,
        avg_cost = ((v_existing_holding.shares * v_existing_holding.avg_cost) + p_dollars) / v_new_shares
      WHERE id = v_existing_holding.id;
    ELSE
      INSERT INTO holdings (portfolio_id, ticker, shares, avg_cost)
      VALUES (p_portfolio_id, v_ticker, v_shares, p_price);
    END IF;

    UPDATE portfolios
    SET cash_balance = cash_balance - p_dollars
    WHERE id = p_portfolio_id
    RETURNING * INTO v_portfolio;
  ELSE
    IF v_existing_holding.id IS NULL THEN
      RAISE EXCEPTION 'You do not own this stock';
    END IF;

    IF v_shares > v_existing_holding.shares + 0.0001 THEN
      RAISE EXCEPTION 'Not enough shares';
    END IF;

    INSERT INTO trades (portfolio_id, user_id, ticker, side, dollars, shares, price, rationale)
    VALUES (p_portfolio_id, v_uid, v_ticker, 'sell', p_dollars, v_shares, p_price, NULLIF(TRIM(p_rationale), ''));

    v_new_shares := v_existing_holding.shares - v_shares;
    IF v_new_shares < 0.001 THEN
      DELETE FROM holdings WHERE id = v_existing_holding.id;
    ELSE
      UPDATE holdings
      SET shares = v_new_shares
      WHERE id = v_existing_holding.id;
    END IF;

    UPDATE portfolios
    SET cash_balance = cash_balance + p_dollars
    WHERE id = p_portfolio_id
    RETURNING * INTO v_portfolio;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'shares', v_shares,
    'price', p_price,
    'cash_balance', v_portfolio.cash_balance,
    'ticker', v_ticker,
    'side', p_side
  );
END;
$$;

REVOKE ALL ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text) TO authenticated;

-- Force all trade creation through execute_trade() so constraints are always enforced.
DROP POLICY IF EXISTS "Group members can insert trades" ON trades;
CREATE POLICY "Trades inserts disabled for clients" ON trades
  FOR INSERT
  WITH CHECK (false);
