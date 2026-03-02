-- Fix portfolio_snapshots RLS: drop and recreate with correct ownership check
DROP POLICY IF EXISTS "Users can insert own snapshots" ON portfolio_snapshots;
DROP POLICY IF EXISTS "Users can read own snapshots" ON portfolio_snapshots;

-- Allow insert if the portfolio belongs to the current user OR is a group portfolio they're a member of
CREATE POLICY "Users can insert snapshots for their portfolios" ON portfolio_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_id
        AND (
          (p.owner_type = 'user' AND p.owner_id = auth.uid())
          OR
          (p.owner_type = 'group' AND EXISTS (
            SELECT 1 FROM class_memberships cm WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
          ))
        )
    )
  );

CREATE POLICY "Users can read snapshots for their portfolios" ON portfolio_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p
      WHERE p.id = portfolio_id
        AND (
          (p.owner_type = 'user' AND p.owner_id = auth.uid())
          OR
          (p.owner_type = 'group' AND EXISTS (
            SELECT 1 FROM class_memberships cm WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
          ))
        )
    )
  );
