-- Rename training_courses -> training_tutorials
-- Rename training_modules -> training_steps
-- Rename class_training_courses -> class_training_tutorials

-- Drop policies first
DROP POLICY IF EXISTS "Anyone can read active training courses" ON training_courses;
DROP POLICY IF EXISTS "Admins can manage training courses" ON training_courses;
DROP POLICY IF EXISTS "Anyone can read training modules" ON training_modules;
DROP POLICY IF EXISTS "Admins can manage training modules" ON training_modules;
DROP POLICY IF EXISTS "Users can read own training progress" ON training_progress;
DROP POLICY IF EXISTS "Users can insert own training progress" ON training_progress;
DROP POLICY IF EXISTS "Users can update own training progress" ON training_progress;
DROP POLICY IF EXISTS "Teachers can read student progress" ON training_progress;
DROP POLICY IF EXISTS "Teachers can manage their class training courses" ON class_training_courses;
DROP POLICY IF EXISTS "Students can read class training courses" ON class_training_courses;

-- Drop indexes
DROP INDEX IF EXISTS idx_training_courses_status;
DROP INDEX IF EXISTS idx_training_courses_slug;
DROP INDEX IF EXISTS idx_training_modules_course_id;
DROP INDEX IF EXISTS idx_training_progress_user_id;
DROP INDEX IF EXISTS idx_training_progress_module_id;
DROP INDEX IF EXISTS idx_class_training_courses_class_id;
DROP INDEX IF EXISTS idx_class_training_courses_course_id;

-- Rename tables
ALTER TABLE training_courses RENAME TO training_tutorials;
ALTER TABLE training_modules RENAME TO training_steps;
ALTER TABLE class_training_courses RENAME TO class_training_tutorials;

-- Rename columns
ALTER TABLE training_steps RENAME COLUMN training_course_id TO training_tutorial_id;
ALTER TABLE training_progress RENAME COLUMN training_module_id TO training_step_id;
ALTER TABLE class_training_tutorials RENAME COLUMN training_course_id TO training_tutorial_id;

-- Rename constraints
ALTER TABLE training_steps RENAME CONSTRAINT training_modules_training_course_id_fkey TO training_steps_training_tutorial_id_fkey;
ALTER TABLE training_progress RENAME CONSTRAINT training_progress_training_module_id_fkey TO training_progress_training_step_id_fkey;
ALTER TABLE class_training_tutorials RENAME CONSTRAINT class_training_courses_training_course_id_fkey TO class_training_tutorials_training_tutorial_id_fkey;
ALTER TABLE class_training_tutorials RENAME CONSTRAINT class_training_courses_class_id_fkey TO class_training_tutorials_class_id_fkey;

-- Rename unique constraints
ALTER TABLE training_steps RENAME CONSTRAINT training_modules_training_course_id_slug_key TO training_steps_training_tutorial_id_slug_key;
ALTER TABLE training_progress RENAME CONSTRAINT training_progress_user_id_training_module_id_key TO training_progress_user_id_training_step_id_key;
ALTER TABLE class_training_tutorials RENAME CONSTRAINT class_training_courses_class_id_training_course_id_key TO class_training_tutorials_class_id_training_tutorial_id_key;

-- Recreate indexes with new names
CREATE INDEX idx_training_tutorials_status ON training_tutorials(status);
CREATE INDEX idx_training_tutorials_slug ON training_tutorials(slug);
CREATE INDEX idx_training_steps_tutorial_id ON training_steps(training_tutorial_id);
CREATE INDEX idx_training_progress_user_id ON training_progress(user_id);
CREATE INDEX idx_training_progress_step_id ON training_progress(training_step_id);
CREATE INDEX idx_class_training_tutorials_class_id ON class_training_tutorials(class_id);
CREATE INDEX idx_class_training_tutorials_tutorial_id ON class_training_tutorials(training_tutorial_id);

-- Recreate RLS policies
CREATE POLICY "Anyone can read active training tutorials" ON training_tutorials
  FOR SELECT USING (status = 'active' OR is_admin());

CREATE POLICY "Admins can manage training tutorials" ON training_tutorials
  FOR ALL USING (is_admin());

CREATE POLICY "Anyone can read training steps" ON training_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM training_tutorials tt
      WHERE tt.id = training_steps.training_tutorial_id
      AND (tt.status = 'active' OR is_admin())
    )
  );

CREATE POLICY "Admins can manage training steps" ON training_steps
  FOR ALL USING (is_admin());

CREATE POLICY "Users can read own training progress" ON training_progress
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert own training progress" ON training_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own training progress" ON training_progress
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Teachers can read student progress" ON training_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_memberships cm
      JOIN classes c ON c.id = cm.class_id
      WHERE cm.user_id = training_progress.user_id
      AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can manage their class tutorials" ON class_training_tutorials
  FOR ALL USING (
    is_teacher_of_class(class_id) OR is_admin()
  );

CREATE POLICY "Students can read class tutorials" ON class_training_tutorials
  FOR SELECT USING (
    is_member_of_class(class_id)
  );
