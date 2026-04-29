-- Fix: execute_pending_trade_order re-raised after marking the order failed,
-- which rolled back the status='failed' UPDATE alongside the trade attempt.
-- Stuck orders re-ran on every cron tick and spammed admin alerts.
-- Now we capture the error, persist status='failed', and return a failure
-- jsonb instead of raising so the UPDATE commits.

CREATE OR REPLACE FUNCTION execute_pending_trade_order(
  p_order_id uuid,
  p_price numeric,
  p_benchmark_price numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order pending_trade_orders%ROWTYPE;
  v_result jsonb;
  v_err text;
BEGIN
  SELECT *
  INTO v_order
  FROM pending_trade_orders
  WHERE id = p_order_id
    AND status IN ('queued', 'processing')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending order not found';
  END IF;

  UPDATE pending_trade_orders
  SET
    status = 'processing',
    error_message = NULL
  WHERE id = p_order_id;

  BEGIN
    v_result := execute_trade_internal(
      v_order.user_id,
      v_order.portfolio_id,
      v_order.ticker,
      v_order.side,
      v_order.dollars,
      p_price,
      v_order.rationale,
      v_order.approval_code,
      p_benchmark_price
    );

    UPDATE pending_trade_orders
    SET
      status = 'executed',
      processed_at = now(),
      executed_at = now(),
      execution_price = p_price,
      shares = NULLIF(v_result ->> 'shares', '')::numeric,
      trade_id = NULLIF(v_result ->> 'trade_id', '')::uuid,
      error_message = NULL
    WHERE id = p_order_id;

    RETURN v_result || jsonb_build_object('order_id', p_order_id, 'status', 'executed');
  EXCEPTION
    WHEN OTHERS THEN
      v_err := SQLERRM;
      UPDATE pending_trade_orders
      SET
        status = 'failed',
        processed_at = now(),
        error_message = v_err
      WHERE id = p_order_id;

      RETURN jsonb_build_object(
        'order_id', p_order_id,
        'status', 'failed',
        'error', v_err
      );
  END;
END;
$$;

REVOKE ALL ON FUNCTION execute_pending_trade_order(uuid, numeric, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION execute_pending_trade_order(uuid, numeric, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION execute_pending_trade_order(uuid, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION execute_pending_trade_order(uuid, numeric, numeric) TO service_role;
