-- Audit log table: captures every change to holdings and portfolios
CREATE TABLE IF NOT EXISTS portfolio_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  action text NOT NULL, -- INSERT, UPDATE, DELETE
  record_id uuid,
  portfolio_id uuid,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  note text -- optional manual note
);

-- Index for fast lookups
CREATE INDEX idx_audit_portfolio_id ON portfolio_audit_log(portfolio_id);
CREATE INDEX idx_audit_changed_at ON portfolio_audit_log(changed_at DESC);
CREATE INDEX idx_audit_table_name ON portfolio_audit_log(table_name);

-- RLS: only service role and admins can read audit log
ALTER TABLE portfolio_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit log" ON portfolio_audit_log
  FOR SELECT USING (is_admin());

-- Trigger function for holdings
CREATE OR REPLACE FUNCTION audit_holdings_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO portfolio_audit_log(table_name, action, record_id, portfolio_id, new_data, changed_by)
    VALUES ('holdings', 'INSERT', NEW.id, NEW.portfolio_id, to_jsonb(NEW), auth.uid());

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO portfolio_audit_log(table_name, action, record_id, portfolio_id, old_data, new_data, changed_by)
    VALUES ('holdings', 'UPDATE', NEW.id, NEW.portfolio_id, to_jsonb(OLD), to_jsonb(NEW), auth.uid());

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO portfolio_audit_log(table_name, action, record_id, portfolio_id, old_data, changed_by)
    VALUES ('holdings', 'DELETE', OLD.id, OLD.portfolio_id, to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for portfolios
CREATE OR REPLACE FUNCTION audit_portfolio_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO portfolio_audit_log(table_name, action, record_id, portfolio_id, new_data, changed_by)
    VALUES ('portfolios', 'INSERT', NEW.id, NEW.id, to_jsonb(NEW), auth.uid());

  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO portfolio_audit_log(table_name, action, record_id, portfolio_id, old_data, new_data, changed_by)
    VALUES ('portfolios', 'UPDATE', NEW.id, NEW.id, to_jsonb(OLD), to_jsonb(NEW), auth.uid());

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO portfolio_audit_log(table_name, action, record_id, portfolio_id, old_data, changed_by)
    VALUES ('portfolios', 'DELETE', OLD.id, OLD.id, to_jsonb(OLD), auth.uid());
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach triggers
CREATE TRIGGER holdings_audit
  AFTER INSERT OR UPDATE OR DELETE ON holdings
  FOR EACH ROW EXECUTE FUNCTION audit_holdings_changes();

CREATE TRIGGER portfolios_audit
  AFTER INSERT OR UPDATE OR DELETE ON portfolios
  FOR EACH ROW EXECUTE FUNCTION audit_portfolio_changes();
