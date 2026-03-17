-- Add retry tracking to pending orders to prevent head-of-line blocking.
ALTER TABLE pending_trade_orders ADD COLUMN IF NOT EXISTS attempts integer DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_pending_trade_orders_attempts ON pending_trade_orders(attempts) WHERE status IN ('queued', 'processing');
