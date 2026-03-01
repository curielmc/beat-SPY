-- Teacher invite codes table
CREATE TABLE teacher_invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES profiles(id),
  used_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  is_used boolean DEFAULT false
);

ALTER TABLE teacher_invite_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can validate a code (needed during signup before user is authenticated)
CREATE POLICY "Anyone can read invite codes" ON teacher_invite_codes
  FOR SELECT USING (true);

-- Only admins and teachers can create codes
CREATE POLICY "Teachers and admins can create invite codes" ON teacher_invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

-- Only admins can update (mark as used is done server-side via RPC)
CREATE POLICY "Admins can update invite codes" ON teacher_invite_codes
  FOR UPDATE USING (is_admin());

-- RPC to validate and consume an invite code (runs as SECURITY DEFINER)
CREATE OR REPLACE FUNCTION use_teacher_invite_code(invite_code text, new_user_id uuid)
RETURNS boolean AS $$
DECLARE
  code_record teacher_invite_codes%ROWTYPE;
BEGIN
  SELECT * INTO code_record FROM teacher_invite_codes
    WHERE code = UPPER(invite_code)
      AND is_used = false
      AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE teacher_invite_codes
    SET is_used = true, used_by = new_user_id, used_at = now()
    WHERE id = code_record.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
