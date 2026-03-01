-- Migration 003: Bull/Bear Takes + Followers + Activity Feed
-- Run this in the Supabase SQL Editor AFTER 002_individual_features.sql

-- ============================================
-- INVESTMENT_THESES: Add takes columns
-- ============================================

ALTER TABLE investment_theses ADD COLUMN side text CHECK (side IN ('bull', 'bear'));
ALTER TABLE investment_theses ADD COLUMN target_price numeric;
ALTER TABLE investment_theses ADD COLUMN target_date date;
ALTER TABLE investment_theses ADD COLUMN outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'correct', 'incorrect', 'expired'));
ALTER TABLE investment_theses ADD COLUMN outcome_resolved_at timestamptz;
ALTER TABLE investment_theses ADD COLUMN price_at_creation numeric;

-- Make title optional for takes (only side-based posts)
ALTER TABLE investment_theses ALTER COLUMN title DROP NOT NULL;

-- 280-char limit only applies to takes (rows with side set)
ALTER TABLE investment_theses ADD CONSTRAINT takes_body_length CHECK (side IS NULL OR length(body) <= 280);

-- One take per user per ticker per day
CREATE UNIQUE INDEX idx_one_take_per_day ON investment_theses (user_id, ticker, (created_at::date))
  WHERE side IS NOT NULL;

-- Index for feed queries
CREATE INDEX idx_investment_theses_side ON investment_theses(side) WHERE side IS NOT NULL;
CREATE INDEX idx_investment_theses_created_at ON investment_theses(created_at DESC);

-- ============================================
-- FOLLOWS TABLE
-- ============================================

CREATE TABLE follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  followed_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_follow CHECK (follower_id != followed_id),
  CONSTRAINT unique_follow UNIQUE (follower_id, followed_id)
);

CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_followed ON follows(followed_id);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Follows are readable by anyone" ON follows
  FOR SELECT USING (true);

CREATE POLICY "Users can follow others" ON follows
  FOR INSERT WITH CHECK (follower_id = auth.uid());

CREATE POLICY "Users can unfollow" ON follows
  FOR DELETE USING (follower_id = auth.uid());

-- ============================================
-- PROFILES: Add follower/following counts
-- ============================================

ALTER TABLE profiles ADD COLUMN follower_count integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN following_count integer NOT NULL DEFAULT 0;

-- Trigger to keep counts in sync
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET follower_count = follower_count + 1 WHERE id = NEW.followed_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0) WHERE id = OLD.followed_id;
    UPDATE profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_follow_counts
  AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- ============================================
-- UPDATE PUBLIC LEADERBOARD VIEW
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
  prof.follower_count,
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
-- RLS: Update investment_theses for public takes
-- ============================================

-- Drop existing policies and recreate with takes support
DROP POLICY IF EXISTS "Public theses are readable by anyone" ON investment_theses;

CREATE POLICY "Public theses and takes are readable by anyone" ON investment_theses
  FOR SELECT USING (is_public = true OR user_id = auth.uid() OR is_admin());

-- Allow updating outcome on public takes (for client-side resolution)
CREATE POLICY "Users can resolve outcomes on own takes" ON investment_theses
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
