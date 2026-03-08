-- Restore teacher class scoping, extend hard trade execution to competition
-- portfolios, move benchmark writes into the RPC path, and align visibility
-- with public-read behavior.

-- Re-assert teacher scoping in case 006_any_teacher_access was replayed out of
-- order on a remote environment.
CREATE OR REPLACE FUNCTION is_teacher_of_class(class_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM classes
    WHERE id = class_uuid
      AND teacher_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

DROP POLICY IF EXISTS "Teachers can manage all classes" ON classes;
DROP POLICY IF EXISTS "Teachers can manage own classes" ON classes;
CREATE POLICY "Teachers can manage own classes" ON classes
  FOR ALL
  USING (
    teacher_id = auth.uid() OR is_admin()
  )
  WITH CHECK (
    teacher_id = auth.uid() OR is_admin()
  );

DROP POLICY IF EXISTS "Teachers can read students in their classes" ON profiles;
CREATE POLICY "Teachers can read students in their classes" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM class_memberships cm
      JOIN classes c ON c.id = cm.class_id
      WHERE cm.user_id = profiles.id
        AND c.teacher_id = auth.uid()
    )
    OR id = auth.uid()
    OR is_admin()
  );

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
    VALUES (p_portfolio_id, v_uid, v_ticker, 'buy', p_dollars, v_shares, p_price, NULLIF(TRIM(p_rationale), ''));

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
    'shares', v_shares,
    'price', p_price,
    'cash_balance', v_portfolio.cash_balance,
    'ticker', v_ticker,
    'side', p_side
  );
END;
$$;

REVOKE ALL ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION execute_trade(uuid, text, text, numeric, numeric, text, text, numeric) TO authenticated;

DROP POLICY IF EXISTS "Portfolio access for group members and teachers" ON portfolios;
CREATE POLICY "Portfolio access for owners, group members, and teachers" ON portfolios
  FOR SELECT USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'competition' AND owner_id = auth.uid()) OR
    (owner_type = 'group' AND EXISTS (
      SELECT 1 FROM class_memberships cm
      WHERE cm.group_id = portfolios.owner_id AND cm.user_id = auth.uid()
    )) OR
    (owner_type = 'group' AND EXISTS (
      SELECT 1 FROM groups g
      JOIN classes c ON c.id = g.class_id
      WHERE g.id = portfolios.owner_id AND c.teacher_id = auth.uid()
    )) OR
    is_admin()
  );

DROP POLICY IF EXISTS "Portfolio insert for group members" ON portfolios;
CREATE POLICY "Portfolio insert for owners" ON portfolios
  FOR INSERT WITH CHECK (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'competition' AND owner_id = auth.uid()) OR
    auth.uid() IS NOT NULL
  );

DROP POLICY IF EXISTS "Portfolio update for group members and teachers" ON portfolios;
CREATE POLICY "Portfolio update for owners, group members, and teachers" ON portfolios
  FOR UPDATE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'competition' AND owner_id = auth.uid()) OR
    (owner_type = 'group' AND EXISTS (
      SELECT 1 FROM class_memberships cm
      WHERE cm.group_id = portfolios.owner_id AND cm.user_id = auth.uid()
    )) OR
    (owner_type = 'group' AND EXISTS (
      SELECT 1 FROM groups g
      JOIN classes c ON c.id = g.class_id
      WHERE g.id = portfolios.owner_id AND c.teacher_id = auth.uid()
    )) OR
    is_admin()
  );

DROP POLICY IF EXISTS "Holdings follow portfolio access" ON holdings;
CREATE POLICY "Holdings follow portfolio access" ON holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = holdings.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'competition' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Holdings delete for portfolio owners and teachers" ON holdings;
CREATE POLICY "Holdings delete for portfolio owners and teachers" ON holdings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = holdings.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'competition' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Trades follow portfolio access" ON trades;
CREATE POLICY "Trades follow portfolio access" ON trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = trades.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'competition' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Trades delete for portfolio owners and teachers" ON trades;
CREATE POLICY "Trades delete for portfolio owners and teachers" ON trades
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = trades.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'competition' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Benchmark holdings follow portfolio access" ON benchmark_holdings;
CREATE POLICY "Benchmark holdings follow portfolio access" ON benchmark_holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = benchmark_holdings.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'competition' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Benchmark holdings delete for portfolio owners and teachers" ON benchmark_holdings;
CREATE POLICY "Benchmark holdings delete for portfolio owners and teachers" ON benchmark_holdings
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = benchmark_holdings.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'competition' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Benchmark trades follow portfolio access" ON benchmark_trades;
CREATE POLICY "Benchmark trades follow portfolio access" ON benchmark_trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = benchmark_trades.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'competition' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Benchmark trades delete for portfolio owners and teachers" ON benchmark_trades;
CREATE POLICY "Benchmark trades delete for portfolio owners and teachers" ON benchmark_trades
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = benchmark_trades.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'competition' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

DROP POLICY IF EXISTS "Benchmark holdings inserts disabled for clients" ON benchmark_holdings;
CREATE POLICY "Benchmark holdings inserts disabled for clients" ON benchmark_holdings
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Benchmark holdings updates disabled for clients" ON benchmark_holdings;
CREATE POLICY "Benchmark holdings updates disabled for clients" ON benchmark_holdings
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Benchmark trades inserts disabled for clients" ON benchmark_trades;
CREATE POLICY "Benchmark trades inserts disabled for clients" ON benchmark_trades
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "Benchmark trades updates disabled for clients" ON benchmark_trades;
CREATE POLICY "Benchmark trades updates disabled for clients" ON benchmark_trades
  FOR UPDATE USING (false);

DROP POLICY IF EXISTS "Public portfolios are readable by anyone" ON portfolios;
CREATE POLICY "Public portfolios are readable by anyone" ON portfolios
  FOR SELECT USING (
    is_public = true OR visibility = 'public'
  );

DROP POLICY IF EXISTS "Public holdings are readable" ON holdings;
CREATE POLICY "Public holdings are readable" ON holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = holdings.portfolio_id
        AND (p.is_public = true OR p.visibility = 'public')
    )
  );

DROP POLICY IF EXISTS "Public trades are readable" ON trades;
CREATE POLICY "Public trades are readable" ON trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = trades.portfolio_id
        AND (p.is_public = true OR p.visibility = 'public')
    )
  );

DROP POLICY IF EXISTS "Public benchmark holdings are readable" ON benchmark_holdings;
CREATE POLICY "Public benchmark holdings are readable" ON benchmark_holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = benchmark_holdings.portfolio_id
        AND (p.is_public = true OR p.visibility = 'public')
    )
  );

DROP POLICY IF EXISTS "Public benchmark trades are readable" ON benchmark_trades;
CREATE POLICY "Public benchmark trades are readable" ON benchmark_trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = benchmark_trades.portfolio_id
        AND (p.is_public = true OR p.visibility = 'public')
    )
  );

UPDATE portfolios
SET is_public = (visibility = 'public')
WHERE owner_type IN ('user', 'group')
  AND visibility IS NOT NULL;
