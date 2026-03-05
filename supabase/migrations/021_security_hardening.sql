-- Security hardening: restrict sensitive RPCs and invite-code visibility.

-- 1) Invite codes should not be world-readable.
DROP POLICY IF EXISTS "Anyone can read invite codes" ON teacher_invite_codes;
CREATE POLICY "Teachers and admins can read invite codes" ON teacher_invite_codes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- 2) Limit class invite lookup/update RPCs to authenticated users with ownership checks.
CREATE OR REPLACE FUNCTION find_class_invite_by_email(lookup_email text)
RETURNS TABLE(id uuid, class_id uuid, email text, full_name text, class_name text, class_code text, group_name text) AS $$
DECLARE
  caller_email text;
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.email, p.role
    INTO caller_email, caller_role
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_email IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF caller_role NOT IN ('teacher', 'admin')
     AND LOWER(lookup_email) <> LOWER(caller_email) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
    SELECT ci.id, ci.class_id, ci.email, ci.full_name, c.class_name, c.code, ci.group_name
    FROM class_invites ci
    JOIN classes c ON c.id = ci.class_id
    WHERE LOWER(ci.email) = LOWER(lookup_email)
      AND ci.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION mark_invite_joined(invite_id uuid)
RETURNS void AS $$
DECLARE
  caller_email text;
  caller_role text;
  rows_affected integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.email, p.role
    INTO caller_email, caller_role
  FROM profiles p
  WHERE p.id = auth.uid();

  IF caller_email IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF caller_role IN ('teacher', 'admin') THEN
    UPDATE class_invites
      SET status = 'joined', joined_at = now()
      WHERE id = invite_id;
  ELSE
    UPDATE class_invites
      SET status = 'joined', joined_at = now()
      WHERE id = invite_id
        AND LOWER(email) = LOWER(caller_email);
  END IF;

  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected = 0 THEN
    RAISE EXCEPTION 'Invite not found or not authorized';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3) Harden atomic cash update RPC with explicit authorization checks.
CREATE OR REPLACE FUNCTION adjust_cash_balance(p_portfolio_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
  caller_role text;
  allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO caller_role FROM profiles WHERE id = auth.uid();
  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM portfolios p
    WHERE p.id = p_portfolio_id
      AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid())
        OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id
            AND cm.user_id = auth.uid()
        ))
        OR
        (p.owner_type = 'group' AND caller_role IN ('teacher', 'admin'))
        OR
        (caller_role = 'admin')
      )
  ) INTO allowed;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Not authorized to update this portfolio';
  END IF;

  UPDATE portfolios
  SET cash_balance = cash_balance + p_delta
  WHERE id = p_portfolio_id
  RETURNING cash_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Portfolio not found';
  END IF;

  IF new_balance < 0 THEN
    RAISE EXCEPTION 'Insufficient cash balance';
  END IF;

  RETURN new_balance;
END;
$$;

-- Lock down function execute grants.
REVOKE ALL ON FUNCTION find_class_invite_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_invite_joined(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION adjust_cash_balance(uuid, numeric) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION find_class_invite_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_invite_joined(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION adjust_cash_balance(uuid, numeric) TO authenticated;
