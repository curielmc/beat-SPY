-- Plan 5 — Notifications
-- In-app notifications table for challenge-related events.

CREATE TABLE competition_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id  uuid REFERENCES competitions(id) ON DELETE CASCADE,
  type            text NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_competition_notifications_user_unread
  ON competition_notifications(user_id, created_at DESC) WHERE read_at IS NULL;

ALTER TABLE competition_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own notifs" ON competition_notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user marks own notifs read" ON competition_notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
