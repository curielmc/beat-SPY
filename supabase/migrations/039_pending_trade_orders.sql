-- Queue after-hours orders and execute them when the market reopens.

CREATE OR REPLACE FUNCTION market_is_open(p_now timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    EXTRACT(ISODOW FROM (p_now AT TIME ZONE 'America/New_York')) <= 5
    AND ((p_now AT TIME ZONE 'America/New_York')::time >= TIME '09:30:00')
    AND ((p_now AT TIME ZONE 'America/New_York')::time < TIME '16:00:00');
$$;

CREATE OR REPLACE FUNCTION next_market_open(p_now timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_et timestamp;
  v_day integer;
BEGIN
  v_et := p_now AT TIME ZONE 'America/New_York';
  v_day := EXTRACT(ISODOW FROM v_et);

  IF v_day <= 5 AND v_et::time < TIME '09:30:00' THEN
    RETURN (date_trunc('day', v_et) + TIME '09:30:00') AT TIME ZONE 'America/New_York';
  END IF;

  IF v_day <= 5 AND v_et::time < TIME '16:00:00' THEN
    RETURN p_now;
  END IF;

  v_et := date_trunc('day', v_et) + interval '1 day';
  WHILE EXTRACT(ISODOW FROM v_et) > 5 LOOP
    v_et := v_et + interval '1 day';
  END LOOP;

  RETURN (date_trunc('day', v_et) + TIME '09:30:00') AT TIME ZONE 'America/New_York';
END;
$$;

CREATE TABLE IF NOT EXISTS pending_trade_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ticker text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  dollars numeric NOT NULL CHECK (dollars > 0),
  rationale text,
  approval_code text,
  submitted_price numeric,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'executed', 'failed', 'cancelled')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  execute_after timestamptz NOT NULL DEFAULT next_market_open(now()),
  processed_at timestamptz,
  executed_at timestamptz,
  execution_price numeric,
  shares numeric,
  trade_id uuid REFERENCES trades(id) ON DELETE SET NULL,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_pending_trade_orders_portfolio_id ON pending_trade_orders(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_pending_trade_orders_user_id ON pending_trade_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_trade_orders_status_execute_after ON pending_trade_orders(status, execute_after);

ALTER TABLE pending_trade_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pending orders readable by owners" ON pending_trade_orders;
CREATE POLICY "Pending orders readable by owners" ON pending_trade_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM portfolios p
      WHERE p.id = pending_trade_orders.portfolio_id
        AND (
          (p.owner_type IN ('user', 'competition') AND p.owner_id = auth.uid()) OR
          (p.owner_type = 'group' AND EXISTS (
            SELECT 1
            FROM class_memberships cm
            WHERE cm.group_id = p.owner_id
              AND cm.user_id = auth.uid()
          )) OR
          (p.owner_type = 'group' AND EXISTS (
            SELECT 1
            FROM groups g
            JOIN classes c ON c.id = g.class_id
            WHERE g.id = p.owner_id
              AND c.teacher_id = auth.uid()
          )) OR
          is_admin()
        )
    )
  );

DROP POLICY IF EXISTS "Pending order inserts disabled for clients" ON pending_trade_orders;
CREATE POLICY "Pending order inserts disabled for clients" ON pending_trade_orders
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Pending order updates disabled for clients" ON pending_trade_orders;
CREATE POLICY "Pending order updates disabled for clients" ON pending_trade_orders
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Pending order deletes disabled for clients" ON pending_trade_orders;
CREATE POLICY "Pending order deletes disabled for clients" ON pending_trade_orders
  FOR DELETE
  USING (false);

CREATE OR REPLACE FUNCTION execute_trade_internal(
  p_actor_uid uuid,
  p_portfolio_id uuid,
  p_ticker text,
  p_side text,
  p_dollars numeric,
  p_price numeric,
  p_rationale text DEFAULT NULL,
  p_approval_code text DEFAULT NULL,
  p_benchmark_price numeric DEFAULT NULL
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
  v_existing_benchmark_holding benchmark_holdings%ROWTYPE;
  v_shares numeric;
  v_new_shares numeric;
  v_ticker text;
  v_competition_id uuid;
  v_comp_status text;
  v_comp_rules jsonb;
  v_holdings_count integer;
  v_current_position_value numeric;
  v_new_position_pct numeric;
  v_benchmark_ticker text;
  v_benchmark_shares numeric;
  v_actual_benchmark_shares numeric;
  v_actual_benchmark_dollars numeric;
  v_trade_id uuid;
BEGIN
  v_uid := p_actor_uid;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT market_is_open(now()) THEN
    RAISE EXCEPTION 'Trading is only available during regular market hours: 9:30 AM to 4:00 PM ET';
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

  SELECT *
  INTO v_portfolio
  FROM portfolios
  WHERE id = p_portfolio_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found';
  END IF;

  v_benchmark_ticker := COALESCE(v_portfolio.benchmark_ticker, 'SPY');

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

    IF COALESCE(v_class.approval_code, '') <> '' THEN
      IF COALESCE(TRIM(p_approval_code), '') <> v_class.approval_code THEN
        RAISE EXCEPTION 'Invalid approval code';
      END IF;
    END IF;

    IF COALESCE((v_fund_restrictions ->> 'requireRationale')::boolean, true) = true THEN
      IF COALESCE(TRIM(p_rationale), '') = '' THEN
        RAISE EXCEPTION 'Please explain your reasoning before trading';
      END IF;
    END IF;

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
  ELSIF v_portfolio.owner_type = 'competition' THEN
    IF v_portfolio.owner_id <> v_uid THEN
      RAISE EXCEPTION 'Not authorized for this competition portfolio';
    END IF;

    IF to_regclass('public.competition_entries') IS NULL OR to_regclass('public.competitions') IS NULL THEN
      RAISE EXCEPTION 'Competition tables are not available in this environment';
    END IF;

    EXECUTE
      'SELECT competition_id
       FROM public.competition_entries
       WHERE portfolio_id = $1 AND user_id = $2
       LIMIT 1'
    INTO v_competition_id
    USING p_portfolio_id, v_uid;

    IF v_competition_id IS NULL THEN
      RAISE EXCEPTION 'Competition entry not found';
    END IF;

    EXECUTE
      'SELECT status, rules
       FROM public.competitions
       WHERE id = $1
       LIMIT 1'
    INTO v_comp_status, v_comp_rules
    USING v_competition_id;

    IF v_comp_status IS NULL THEN
      RAISE EXCEPTION 'Competition not found';
    END IF;

    IF v_comp_status <> 'active' THEN
      RAISE EXCEPTION 'Competition is not active';
    END IF;

    v_comp_rules := COALESCE(v_comp_rules, '{}'::jsonb);
  ELSE
    RAISE EXCEPTION 'Unsupported portfolio owner type';
  END IF;

  v_shares := p_dollars / p_price;

  SELECT *
  INTO v_existing_holding
  FROM holdings
  WHERE portfolio_id = p_portfolio_id
    AND UPPER(ticker) = v_ticker
  FOR UPDATE;

  SELECT *
  INTO v_existing_benchmark_holding
  FROM benchmark_holdings
  WHERE portfolio_id = p_portfolio_id
    AND ticker = v_benchmark_ticker
  FOR UPDATE;

  IF v_portfolio.owner_type = 'competition' AND p_side = 'buy' THEN
    IF (v_comp_rules -> 'restricted_tickers') ? v_ticker THEN
      RAISE EXCEPTION '% is restricted in this competition', v_ticker;
    END IF;

    IF COALESCE((v_comp_rules ->> 'max_position_pct')::numeric, 0) > 0 THEN
      v_current_position_value := COALESCE(v_existing_holding.shares * v_existing_holding.avg_cost, 0);
      v_new_position_pct := ((v_current_position_value + p_dollars) / NULLIF(v_portfolio.starting_cash, 0)) * 100;
      IF v_new_position_pct > (v_comp_rules ->> 'max_position_pct')::numeric THEN
        RAISE EXCEPTION 'Position would exceed %%% limit (%s%%)',
          (v_comp_rules ->> 'max_position_pct')::numeric,
          TO_CHAR(v_new_position_pct, 'FM999999990.0');
      END IF;
    END IF;
  END IF;

  IF p_side = 'buy' THEN
    IF v_portfolio.cash_balance < p_dollars THEN
      RAISE EXCEPTION 'Insufficient cash';
    END IF;

    INSERT INTO trades (portfolio_id, user_id, ticker, side, dollars, shares, price, rationale)
    VALUES (p_portfolio_id, v_uid, v_ticker, 'buy', p_dollars, v_shares, p_price, NULLIF(TRIM(p_rationale), ''))
    RETURNING id INTO v_trade_id;

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

    IF p_benchmark_price IS NOT NULL AND p_benchmark_price > 0 THEN
      v_benchmark_shares := p_dollars / p_benchmark_price;
      INSERT INTO benchmark_trades (portfolio_id, ticker, side, dollars, shares, price)
      VALUES (p_portfolio_id, v_benchmark_ticker, 'buy', p_dollars, v_benchmark_shares, p_benchmark_price);

      IF v_existing_benchmark_holding.id IS NOT NULL THEN
        v_new_shares := v_existing_benchmark_holding.shares + v_benchmark_shares;
        UPDATE benchmark_holdings
        SET
          shares = v_new_shares,
          avg_cost = ((v_existing_benchmark_holding.shares * v_existing_benchmark_holding.avg_cost) + p_dollars) / v_new_shares
        WHERE id = v_existing_benchmark_holding.id;
      ELSE
        INSERT INTO benchmark_holdings (portfolio_id, ticker, shares, avg_cost)
        VALUES (p_portfolio_id, v_benchmark_ticker, v_benchmark_shares, p_benchmark_price);
      END IF;
    END IF;
  ELSE
    IF v_existing_holding.id IS NULL THEN
      RAISE EXCEPTION 'You do not own this stock';
    END IF;

    IF v_shares > v_existing_holding.shares + 0.0001 THEN
      RAISE EXCEPTION 'Not enough shares';
    END IF;

    IF v_portfolio.owner_type = 'competition' AND COALESCE((v_comp_rules ->> 'min_stocks')::integer, 0) > 0 THEN
      SELECT COUNT(*) INTO v_holdings_count
      FROM holdings
      WHERE portfolio_id = p_portfolio_id;

      IF v_holdings_count <= (v_comp_rules ->> 'min_stocks')::integer
         AND (v_existing_holding.shares - v_shares) < 0.001 THEN
        RAISE EXCEPTION 'Must maintain at least % stocks', (v_comp_rules ->> 'min_stocks')::integer;
      END IF;
    END IF;

    INSERT INTO trades (portfolio_id, user_id, ticker, side, dollars, shares, price, rationale)
    VALUES (p_portfolio_id, v_uid, v_ticker, 'sell', p_dollars, v_shares, p_price, NULLIF(TRIM(p_rationale), ''))
    RETURNING id INTO v_trade_id;

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

    IF p_benchmark_price IS NOT NULL AND p_benchmark_price > 0 AND v_existing_benchmark_holding.id IS NOT NULL THEN
      v_benchmark_shares := p_dollars / p_benchmark_price;
      v_actual_benchmark_shares := LEAST(v_benchmark_shares, v_existing_benchmark_holding.shares);
      v_actual_benchmark_dollars := v_actual_benchmark_shares * p_benchmark_price;

      INSERT INTO benchmark_trades (portfolio_id, ticker, side, dollars, shares, price)
      VALUES (p_portfolio_id, v_benchmark_ticker, 'sell', v_actual_benchmark_dollars, v_actual_benchmark_shares, p_benchmark_price);

      v_new_shares := v_existing_benchmark_holding.shares - v_actual_benchmark_shares;
      IF v_new_shares < 0.001 THEN
        DELETE FROM benchmark_holdings WHERE id = v_existing_benchmark_holding.id;
      ELSE
        UPDATE benchmark_holdings
        SET shares = v_new_shares
        WHERE id = v_existing_benchmark_holding.id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'executed',
    'shares', v_shares,
    'price', p_price,
    'cash_balance', v_portfolio.cash_balance,
    'ticker', v_ticker,
    'side', p_side,
    'trade_id', v_trade_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION execute_trade(
  p_portfolio_id uuid,
  p_ticker text,
  p_side text,
  p_dollars numeric,
  p_price numeric,
  p_rationale text DEFAULT NULL,
  p_approval_code text DEFAULT NULL,
  p_benchmark_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN execute_trade_internal(
    auth.uid(),
    p_portfolio_id,
    p_ticker,
    p_side,
    p_dollars,
    p_price,
    p_rationale,
    p_approval_code,
    p_benchmark_price
  );
END;
$$;

CREATE OR REPLACE FUNCTION place_trade_order(
  p_portfolio_id uuid,
  p_ticker text,
  p_side text,
  p_dollars numeric,
  p_price numeric,
  p_rationale text DEFAULT NULL,
  p_approval_code text DEFAULT NULL,
  p_benchmark_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_order_id uuid;
  v_portfolio portfolios%ROWTYPE;
  v_group groups%ROWTYPE;
  v_class classes%ROWTYPE;
  v_restrictions jsonb;
  v_fund_restrictions jsonb;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF market_is_open(now()) THEN
    RETURN execute_trade_internal(
      v_uid,
      p_portfolio_id,
      p_ticker,
      p_side,
      p_dollars,
      p_price,
      p_rationale,
      p_approval_code,
      p_benchmark_price
    );
  END IF;

  IF p_side NOT IN ('buy', 'sell') THEN
    RAISE EXCEPTION 'Invalid trade side';
  END IF;
  IF p_dollars IS NULL OR p_dollars <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT *
  INTO v_portfolio
  FROM portfolios
  WHERE id = p_portfolio_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found';
  END IF;

  IF v_portfolio.owner_type IN ('user', 'competition') THEN
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

    IF COALESCE(v_class.approval_code, '') <> '' THEN
      IF COALESCE(TRIM(p_approval_code), '') <> v_class.approval_code THEN
        RAISE EXCEPTION 'Invalid approval code';
      END IF;
    END IF;

    IF COALESCE((v_fund_restrictions ->> 'requireRationale')::boolean, true) = true THEN
      IF COALESCE(TRIM(p_rationale), '') = '' THEN
        RAISE EXCEPTION 'Please explain your reasoning before trading';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported portfolio owner type';
  END IF;

  INSERT INTO pending_trade_orders (
    portfolio_id,
    user_id,
    ticker,
    side,
    dollars,
    rationale,
    approval_code,
    submitted_price,
    execute_after
  )
  VALUES (
    p_portfolio_id,
    v_uid,
    UPPER(TRIM(p_ticker)),
    p_side,
    p_dollars,
    NULLIF(TRIM(p_rationale), ''),
    NULLIF(TRIM(p_approval_code), ''),
    p_price,
    next_market_open(now())
  )
  RETURNING id INTO v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'queued',
    'order_id', v_order_id,
    'execute_after', next_market_open(now()),
    'ticker', UPPER(TRIM(p_ticker)),
    'side', p_side
  );
END;
$$;

CREATE OR REPLACE FUNCTION execute_pending_trade_order(
  p_order_id uuid,
  p_price numeric,
  p_benchmark_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order pending_trade_orders%ROWTYPE;
  v_result jsonb;
BEGIN
  SELECT *
  INTO v_order
  FROM pending_trade_orders
  WHERE id = p_order_id
    AND status IN ('queued', 'processing')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending order not found';
  END IF;

  UPDATE pending_trade_orders
  SET status = 'processing', error_message = NULL
  WHERE id = p_order_id;

  BEGIN
    v_result := execute_trade_internal(
      v_order.user_id,
      v_order.portfolio_id,
      v_order.ticker,
      v_order.side,
      v_order.dollars,
      p_price,
      v_order.rationale,
      v_order.approval_code,
      p_benchmark_price
    );

    UPDATE pending_trade_orders
    SET
      status = 'executed',
      processed_at = now(),
      executed_at = now(),
      execution_price = p_price,
      shares = COALESCE((v_result ->> 'shares')::numeric, NULL),
      trade_id = NULLIF(v_result ->> 'trade_id', '')::uuid,
      error_message = NULL
    WHERE id = p_order_id;

    RETURN v_result || jsonb_build_object('order_id', p_order_id);
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE pending_trade_orders
      SET
        status = 'failed',
        processed_at = now(),
        error_message = SQLERRM
      WHERE id = p_order_id;
      RAISE;
  END;
END;
$$;

REVOKE ALL ON FUNCTION execute_trade_internal(uuid, uuid, text, text, numeric, numeric, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION place_trade_order(uuid, text, text, numeric, numeric, text, text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION execute_pending_trade_order(uuid, numeric, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION place_trade_order(uuid, text, text, numeric, numeric, text, text, numeric) TO authenticated;
