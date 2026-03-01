-- Add group profile columns
ALTER TABLE groups ADD COLUMN avatar_url text;
ALTER TABLE groups ADD COLUMN bio text;
ALTER TABLE groups ADD COLUMN allow_student_configure boolean DEFAULT false;

-- Drop existing policies on groups so we can replace them
DROP POLICY IF EXISTS "Teachers can manage groups" ON groups;
DROP POLICY IF EXISTS "Students can view their group" ON groups;

-- Teachers (role in teacher, admin) can do everything on groups
CREATE POLICY "Teachers full access to groups"
  ON groups FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('teacher', 'admin')
    )
  );

-- Students can view their own group
CREATE POLICY "Students can view own group"
  ON groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_memberships
      WHERE class_memberships.group_id = groups.id
        AND class_memberships.user_id = auth.uid()
    )
  );

-- Students can update name, avatar_url, bio on their own group
-- only if allow_student_configure = true
CREATE POLICY "Students can update own group if allowed"
  ON groups FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM class_memberships
      WHERE class_memberships.group_id = groups.id
        AND class_memberships.user_id = auth.uid()
    )
    AND allow_student_configure = true
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM class_memberships
      WHERE class_memberships.group_id = groups.id
        AND class_memberships.user_id = auth.uid()
    )
    AND allow_student_configure = true
  );
