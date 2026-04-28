-- Allow service-role inserts (and clarify intent that the dispatcher writes notifications).
-- Service role bypasses RLS in Supabase, but an explicit policy documents the intent
-- and future-proofs against accidental key swaps.

CREATE POLICY "service role can insert notifs" ON competition_notifications
  FOR INSERT WITH CHECK (true);
