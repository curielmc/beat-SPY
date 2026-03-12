-- Record who actually initiated trades, including educator on-behalf actions.

ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS placed_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placed_by_role text CHECK (placed_by_role IN ('student', 'teacher', 'admin'));

ALTER TABLE pending_trade_orders
  ADD COLUMN IF NOT EXISTS placed_by_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS placed_by_role text CHECK (placed_by_role IN ('student', 'teacher', 'admin'));

CREATE INDEX IF NOT EXISTS idx_trades_placed_by_user_id ON trades(placed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_pending_trade_orders_placed_by_user_id ON pending_trade_orders(placed_by_user_id);

UPDATE trades t
SET
  placed_by_user_id = COALESCE(t.placed_by_user_id, t.user_id),
  placed_by_role = COALESCE(t.placed_by_role, p.role)
FROM profiles p
WHERE p.id = t.user_id
  AND (t.placed_by_user_id IS NULL OR t.placed_by_role IS NULL);

UPDATE pending_trade_orders pto
SET
  placed_by_user_id = COALESCE(pto.placed_by_user_id, pto.user_id),
  placed_by_role = COALESCE(pto.placed_by_role, p.role)
FROM profiles p
WHERE p.id = pto.user_id
  AND (pto.placed_by_user_id IS NULL OR pto.placed_by_role IS NULL);
