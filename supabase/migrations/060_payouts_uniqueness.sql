-- Plan 6 review fix: prevent duplicate payouts from concurrent finalize calls.
-- Each user gets at most one payout per competition (mergePayouts already
-- enforces this in code, but the constraint guards against races at the DB level).

ALTER TABLE competition_payouts
  ADD CONSTRAINT competition_payouts_user_per_comp_unique
  UNIQUE (competition_id, user_id);
