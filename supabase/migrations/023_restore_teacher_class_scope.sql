-- Restore teacher access to only their own classes.
-- Reverts the broad access introduced in 006_any_teacher_access.sql.

-- Teachers are only "teacher of class" when they own that class.
CREATE OR REPLACE FUNCTION is_teacher_of_class(class_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1
    FROM classes
    WHERE id = class_uuid
      AND teacher_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Restrict class management to class owner teacher (and admins).
DROP POLICY IF EXISTS "Teachers can manage all classes" ON classes;
DROP POLICY IF EXISTS "Teachers can manage own classes" ON classes;
CREATE POLICY "Teachers can manage own classes" ON classes
  FOR ALL
  USING (
    teacher_id = auth.uid() OR is_admin()
  )
  WITH CHECK (
    teacher_id = auth.uid() OR is_admin()
  );

-- Teachers can read students only in classes they teach (and self/admin).
DROP POLICY IF EXISTS "Teachers can read students in their classes" ON profiles;
CREATE POLICY "Teachers can read students in their classes" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM class_memberships cm
      JOIN classes c ON c.id = cm.class_id
      WHERE cm.user_id = profiles.id
        AND c.teacher_id = auth.uid()
    )
    OR id = auth.uid()
    OR is_admin()
  );
