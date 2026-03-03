-- Drop and recreate to change return type (add group_name)
DROP FUNCTION IF EXISTS find_class_invite_by_email(text);

CREATE FUNCTION find_class_invite_by_email(lookup_email text)
RETURNS TABLE(id uuid, class_id uuid, email text, full_name text, class_name text, class_code text, group_name text) AS $$
BEGIN
  RETURN QUERY
    SELECT ci.id, ci.class_id, ci.email, ci.full_name, c.class_name, c.code, ci.group_name
    FROM class_invites ci
    JOIN classes c ON c.id = ci.class_id
    WHERE LOWER(ci.email) = LOWER(lookup_email)
      AND ci.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
