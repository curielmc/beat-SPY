-- Migration: Any teacher can manage any class (Option 2 - simple multi-teacher)
-- Removes teacher ownership restriction - all teachers share access to all classes

-- Update helper function: any teacher can act as teacher of any class
CREATE OR REPLACE FUNCTION is_teacher_of_class(class_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop old restrictive class policy and replace with teacher-wide access
DROP POLICY IF EXISTS "Teachers can manage own classes" ON classes;
CREATE POLICY "Teachers can manage all classes" ON classes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
    OR is_admin()
  );

-- Update profile visibility: teachers can see students in ANY class
DROP POLICY IF EXISTS "Teachers can read students in their classes" ON profiles;
CREATE POLICY "Teachers can read students in their classes" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_memberships cm
      JOIN classes c ON c.id = cm.class_id
      WHERE cm.user_id = profiles.id
        AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('teacher', 'admin'))
    )
    OR id = auth.uid()
    OR is_admin()
  );
