-- Classmates can read group snapshots (for leaderboard)
CREATE POLICY "Classmates can read group snapshots" ON portfolio_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      JOIN groups g ON g.id = p.owner_id AND p.owner_type = 'group'
      JOIN class_memberships cm ON cm.class_id = g.class_id
      WHERE p.id = portfolio_snapshots.portfolio_id
        AND cm.user_id = auth.uid()
    )
  );

-- Teachers can read snapshots for their class
CREATE POLICY "Teachers can read snapshots" ON portfolio_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      JOIN groups g ON g.id = p.owner_id AND p.owner_type = 'group'
      JOIN classes c ON c.id = g.class_id
      WHERE p.id = portfolio_snapshots.portfolio_id AND c.teacher_id = auth.uid()
    )
  );

-- Admins
CREATE POLICY "Admins can read all snapshots" ON portfolio_snapshots
  FOR SELECT USING (is_admin());

-- Index for fast date lookups
CREATE INDEX IF NOT EXISTS idx_snapshots_type_date ON portfolio_snapshots(snapshot_type, snapshotted_at DESC);
