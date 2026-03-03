-- Pre-load students into a class via invites
CREATE TABLE class_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'joined')),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  UNIQUE(class_id, email)
);

ALTER TABLE class_invites ENABLE ROW LEVEL SECURITY;

-- Teachers can manage all invites
CREATE POLICY "Teachers can manage invites" ON class_invites
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Students can read their own invites (by email match)
CREATE POLICY "Students can read own invites" ON class_invites
  FOR SELECT USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- RPC to find a pending invite by email (SECURITY DEFINER — callable before auth)
CREATE OR REPLACE FUNCTION find_class_invite_by_email(lookup_email text)
RETURNS TABLE(id uuid, class_id uuid, email text, full_name text, class_name text, class_code text) AS $$
BEGIN
  RETURN QUERY
    SELECT ci.id, ci.class_id, ci.email, ci.full_name, c.class_name, c.code
    FROM class_invites ci
    JOIN classes c ON c.id = ci.class_id
    WHERE LOWER(ci.email) = LOWER(lookup_email)
      AND ci.status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC to mark an invite as joined
CREATE OR REPLACE FUNCTION mark_invite_joined(invite_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE class_invites
    SET status = 'joined', joined_at = now()
    WHERE id = invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
