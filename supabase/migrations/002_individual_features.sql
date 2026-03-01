-- Migration 002: Individual user features, public profiles, benchmark choice, reset, visibility
-- Run this in the Supabase SQL Editor AFTER 001_initial_schema.sql

-- ============================================
-- PROFILES: Add public profile fields
-- ============================================

ALTER TABLE profiles ADD COLUMN bio text;
ALTER TABLE profiles ADD COLUMN investment_philosophy text;
ALTER TABLE profiles ADD COLUMN is_public boolean NOT NULL DEFAULT true;
ALTER TABLE profiles ADD COLUMN username text UNIQUE;

-- ============================================
-- CLASSES: Add teacher-controlled settings
-- ============================================

ALTER TABLE classes ADD COLUMN starting_cash numeric NOT NULL DEFAULT 100000;
ALTER TABLE classes ADD COLUMN allow_reset boolean NOT NULL DEFAULT false;
ALTER TABLE classes ADD COLUMN max_portfolios integer NOT NULL DEFAULT 1;

-- ============================================
-- PORTFOLIOS: Add visibility, reset, benchmark config
-- ============================================

ALTER TABLE portfolios ADD COLUMN is_public boolean NOT NULL DEFAULT true;
ALTER TABLE portfolios ADD COLUMN benchmark_ticker text NOT NULL DEFAULT 'SPY';
ALTER TABLE portfolios ADD COLUMN allow_reset boolean NOT NULL DEFAULT true;
ALTER TABLE portfolios ADD COLUMN name text;
ALTER TABLE portfolios ADD COLUMN description text;

-- ============================================
-- PORTFOLIO_RESETS: Track reset history so old records can stay visible
-- ============================================

CREATE TABLE portfolio_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  holdings_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  trades_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  benchmark_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_value numeric NOT NULL,
  final_return_pct numeric NOT NULL,
  starting_cash numeric NOT NULL,
  benchmark_ticker text NOT NULL DEFAULT 'SPY',
  kept_visible boolean NOT NULL DEFAULT true,
  reset_at timestamptz DEFAULT now()
);

CREATE INDEX idx_portfolio_resets_portfolio_id ON portfolio_resets(portfolio_id);

ALTER TABLE portfolio_resets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio resets follow portfolio access" ON portfolio_resets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = portfolio_resets.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.is_public = true AND portfolio_resets.kept_visible = true) OR
        is_admin()
      )
    )
  );

CREATE POLICY "Users can insert own resets" ON portfolio_resets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = portfolio_resets.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        is_admin()
      )
    )
  );

CREATE POLICY "Users can update own resets" ON portfolio_resets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = portfolio_resets.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        is_admin()
      )
    )
  );

-- ============================================
-- INVESTMENT_THESES: Posts linked to portfolios
-- ============================================

CREATE TABLE investment_theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE,
  ticker text,
  title text NOT NULL,
  body text NOT NULL,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_investment_theses_user_id ON investment_theses(user_id);
CREATE INDEX idx_investment_theses_portfolio_id ON investment_theses(portfolio_id);
CREATE INDEX idx_investment_theses_ticker ON investment_theses(ticker);

ALTER TABLE investment_theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public theses are readable by anyone" ON investment_theses
  FOR SELECT USING (is_public = true OR user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can manage own theses" ON investment_theses
  FOR ALL USING (user_id = auth.uid() OR is_admin());

-- ============================================
-- PUBLIC ACCESS POLICIES
-- ============================================

-- Anyone (even unauthenticated) can read public profiles
CREATE POLICY "Public profiles are readable by anyone" ON profiles
  FOR SELECT USING (is_public = true);

-- Public portfolios readable by anyone
CREATE POLICY "Public portfolios are readable by anyone" ON portfolios
  FOR SELECT USING (is_public = true);

-- Public portfolio holdings readable
CREATE POLICY "Public holdings are readable" ON holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = holdings.portfolio_id AND p.is_public = true
    )
  );

-- Public portfolio trades readable
CREATE POLICY "Public trades are readable" ON trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = trades.portfolio_id AND p.is_public = true
    )
  );

-- Public benchmark data readable
CREATE POLICY "Public benchmark holdings are readable" ON benchmark_holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = benchmark_holdings.portfolio_id AND p.is_public = true
    )
  );

CREATE POLICY "Public benchmark trades are readable" ON benchmark_trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = benchmark_trades.portfolio_id AND p.is_public = true
    )
  );

-- ============================================
-- VIEW: Public leaderboard (materialized for performance)
-- ============================================

CREATE OR REPLACE VIEW public_leaderboard AS
SELECT
  p.id AS portfolio_id,
  p.owner_type,
  p.owner_id,
  p.name AS portfolio_name,
  p.starting_cash,
  p.cash_balance,
  p.benchmark_ticker,
  p.created_at,
  prof.full_name,
  prof.username,
  prof.avatar_url,
  prof.bio,
  g.name AS group_name,
  COALESCE(
    (SELECT count(*) FROM trades t WHERE t.portfolio_id = p.id),
    0
  ) AS trade_count,
  COALESCE(
    (SELECT count(*) FROM holdings h WHERE h.portfolio_id = p.id),
    0
  ) AS holdings_count
FROM portfolios p
LEFT JOIN profiles prof ON p.owner_type = 'user' AND p.owner_id = prof.id
LEFT JOIN groups g ON p.owner_type = 'group' AND p.owner_id = g.id
WHERE p.is_public = true;

-- ============================================
-- FUNCTION: Reset a portfolio (preserves history)
-- ============================================

CREATE OR REPLACE FUNCTION reset_portfolio(
  p_portfolio_id uuid,
  p_keep_visible boolean DEFAULT true
)
RETURNS void AS $$
DECLARE
  v_portfolio portfolios%ROWTYPE;
  v_holdings jsonb;
  v_trades jsonb;
  v_benchmark jsonb;
  v_final_value numeric;
BEGIN
  -- Get current portfolio
  SELECT * INTO v_portfolio FROM portfolios WHERE id = p_portfolio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Portfolio not found';
  END IF;

  -- Snapshot holdings
  SELECT COALESCE(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
  INTO v_holdings
  FROM holdings h WHERE h.portfolio_id = p_portfolio_id;

  -- Snapshot trades
  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)
  INTO v_trades
  FROM trades t WHERE t.portfolio_id = p_portfolio_id;

  -- Snapshot benchmark
  SELECT jsonb_build_object(
    'holdings', COALESCE((SELECT jsonb_agg(to_jsonb(bh)) FROM benchmark_holdings bh WHERE bh.portfolio_id = p_portfolio_id), '[]'::jsonb),
    'trades', COALESCE((SELECT jsonb_agg(to_jsonb(bt)) FROM benchmark_trades bt WHERE bt.portfolio_id = p_portfolio_id), '[]'::jsonb)
  ) INTO v_benchmark;

  -- Calculate final value (cash + holdings at avg_cost as approximation)
  SELECT v_portfolio.cash_balance + COALESCE(SUM(h.shares * h.avg_cost), 0)
  INTO v_final_value
  FROM holdings h WHERE h.portfolio_id = p_portfolio_id;

  -- Save reset record
  INSERT INTO portfolio_resets (
    portfolio_id, holdings_snapshot, trades_snapshot, benchmark_snapshot,
    final_value, final_return_pct, starting_cash, benchmark_ticker, kept_visible
  ) VALUES (
    p_portfolio_id, v_holdings, v_trades, v_benchmark,
    v_final_value,
    ((v_final_value - v_portfolio.starting_cash) / v_portfolio.starting_cash) * 100,
    v_portfolio.starting_cash,
    v_portfolio.benchmark_ticker,
    p_keep_visible
  );

  -- Clear current data
  DELETE FROM holdings WHERE portfolio_id = p_portfolio_id;
  DELETE FROM trades WHERE portfolio_id = p_portfolio_id;
  DELETE FROM benchmark_holdings WHERE portfolio_id = p_portfolio_id;
  DELETE FROM benchmark_trades WHERE portfolio_id = p_portfolio_id;

  -- Reset cash balance
  UPDATE portfolios
  SET cash_balance = starting_cash
  WHERE id = p_portfolio_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
