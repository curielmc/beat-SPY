-- Plan 5 — Notifications
-- Track per-competition last digest send time so the cron can throttle digest emits.

ALTER TABLE competitions
  ADD COLUMN last_digest_sent_at timestamptz;
