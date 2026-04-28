-- Migration 055: Charity-first payout destinations
-- Adds payout_mode, default_charity, charity_choice, payout_destination, and system_settings table
-- Spec addendum: docs/superpowers/specs/2026-04-27-challenges-module-design.md (Section 10 — payouts)

ALTER TABLE competitions
  ADD COLUMN payout_mode text NOT NULL DEFAULT 'charity_required'
      CHECK (payout_mode IN ('charity_required','charity_or_cash','cash_required')),
  ADD COLUMN default_charity jsonb;

-- Enforce: default_charity must be present when charity is in play
ALTER TABLE competitions ADD CONSTRAINT competitions_default_charity_required
  CHECK (
    payout_mode = 'cash_required' OR default_charity IS NOT NULL
  );

ALTER TABLE competition_entries
  ADD COLUMN charity_choice jsonb,
  ADD COLUMN payout_destination text NOT NULL DEFAULT 'charity'
      CHECK (payout_destination IN ('charity','self'));

ALTER TABLE competition_payouts
  ADD COLUMN destination text NOT NULL DEFAULT 'charity'
      CHECK (destination IN ('charity','self')),
  ADD COLUMN charity jsonb;

-- Platform-wide fallback charity (and future global settings)
CREATE TABLE system_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "system_settings readable by all authenticated" ON system_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "system_settings mutable by admins" ON system_settings
  FOR ALL USING (is_admin());

-- Seed row (no charity yet — admin sets via UI / direct UPDATE)
INSERT INTO system_settings (key, value) VALUES
  ('default_charity', '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;
