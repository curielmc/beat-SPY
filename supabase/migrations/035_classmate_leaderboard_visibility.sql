-- Allow students to read portfolios for any group in their class (for leaderboard)
CREATE POLICY "Classmates can read group portfolios" ON portfolios
  FOR SELECT USING (
    owner_type = 'group' AND EXISTS (
      SELECT 1 FROM groups g
      JOIN class_memberships cm ON cm.class_id = g.class_id
      WHERE g.id = portfolios.owner_id
        AND cm.user_id = auth.uid()
    )
  );

-- Allow students to read holdings for any group portfolio in their class
CREATE POLICY "Classmates can read group holdings" ON holdings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      JOIN groups g ON g.id = p.owner_id AND p.owner_type = 'group'
      JOIN class_memberships cm ON cm.class_id = g.class_id
      WHERE p.id = holdings.portfolio_id
        AND cm.user_id = auth.uid()
    )
  );

-- Allow students to read trades for any group portfolio in their class
CREATE POLICY "Classmates can read group trades" ON trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      JOIN groups g ON g.id = p.owner_id AND p.owner_type = 'group'
      JOIN class_memberships cm ON cm.class_id = g.class_id
      WHERE p.id = trades.portfolio_id
        AND cm.user_id = auth.uid()
    )
  );
