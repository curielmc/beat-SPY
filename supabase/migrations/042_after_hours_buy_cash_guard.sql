-- Prevent after-hours queued buys from relying on future sale proceeds.
-- Queued buys may only use cash already available after accounting for other queued buys.

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
  v_reserved_buy_dollars numeric := 0;
  v_available_buy_cash numeric := 0;
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

  IF p_side = 'buy' THEN
    SELECT COALESCE(SUM(dollars), 0)
    INTO v_reserved_buy_dollars
    FROM pending_trade_orders
    WHERE portfolio_id = p_portfolio_id
      AND side = 'buy'
      AND status IN ('queued', 'processing');

    v_available_buy_cash := GREATEST(COALESCE(v_portfolio.cash_balance, 0) - v_reserved_buy_dollars, 0);

    IF p_dollars > v_available_buy_cash THEN
      RAISE EXCEPTION 'After-hours buy orders can only use cash already in the account. Available cash for queued buys: $%', TRIM(TO_CHAR(v_available_buy_cash, 'FM9999999990.00'));
    END IF;
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
