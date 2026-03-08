-- Fix infinite recursion in RLS policies caused by inline profiles subqueries.
--
-- Root cause: Multiple RLS policies across tables used inline
-- `SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ...` subqueries.
-- When these policies are evaluated, they trigger profiles RLS evaluation,
-- which triggers is_admin() or other policies, creating infinite recursion.
--
-- Fix: 
-- 1. Rewrite is_admin() as plpgsql SECURITY DEFINER + SET to bypass RLS
-- 2. Replace ALL inline profiles subqueries in policies with is_admin() calls
-- 3. Use auth.email() instead of profiles subquery for email checks

-- ============================================================
-- Fix 1: Rewrite is_admin() to properly bypass RLS
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;

-- ============================================================
-- Fix 2: profiles policies - remove self-referencing subqueries
-- ============================================================
DROP POLICY IF EXISTS "Teachers can read students in their classes" ON profiles;
CREATE POLICY "Teachers can read students in their classes" ON profiles
  FOR SELECT USING (
    (EXISTS (
      SELECT 1
      FROM class_memberships cm
      JOIN classes c ON c.id = cm.class_id
      WHERE cm.user_id = profiles.id
        AND (c.teacher_id = auth.uid() OR is_admin())
    ))
    OR id = auth.uid()
    OR is_admin()
  );

-- ============================================================
-- Fix 3: Replace inline profiles subqueries across all tables
-- ============================================================

-- classes
DROP POLICY IF EXISTS "Teachers can manage all classes" ON classes;
CREATE POLICY "Teachers can manage all classes" ON classes
  FOR ALL USING (teacher_id = auth.uid() OR is_admin());

-- portfolios
DROP POLICY IF EXISTS "Admins can read all portfolios" ON portfolios;
CREATE POLICY "Admins can read all portfolios" ON portfolios
  FOR SELECT USING (is_admin());

-- trades
DROP POLICY IF EXISTS "Admins can read all trades" ON trades;
CREATE POLICY "Admins can read all trades" ON trades
  FOR SELECT USING (is_admin());

-- holdings
DROP POLICY IF EXISTS "Admins can read all holdings" ON holdings;
CREATE POLICY "Admins can read all holdings" ON holdings
  FOR SELECT USING (is_admin());

-- groups
DROP POLICY IF EXISTS "Teachers full access to groups" ON groups;
CREATE POLICY "Teachers full access to groups" ON groups
  FOR ALL USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM classes c WHERE c.id = groups.class_id AND c.teacher_id = auth.uid())
  );

-- messages
DROP POLICY IF EXISTS "Teachers and admins can read all messages" ON messages;
CREATE POLICY "Teachers and admins can read all messages" ON messages
  FOR SELECT USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM classes c
      JOIN class_memberships cm ON cm.class_id = c.id
      WHERE cm.user_id = messages.recipient_id AND c.teacher_id = auth.uid()
    )
  );

-- teacher_invite_codes
DROP POLICY IF EXISTS "Teachers and admins can read invite codes" ON teacher_invite_codes;
CREATE POLICY "Teachers and admins can read invite codes" ON teacher_invite_codes
  FOR SELECT USING (is_admin() OR created_by = auth.uid());

-- class_invites
DROP POLICY IF EXISTS "Teachers can manage invites" ON class_invites;
CREATE POLICY "Teachers can manage invites" ON class_invites
  FOR ALL USING (
    is_admin()
    OR EXISTS (SELECT 1 FROM classes c WHERE c.id = class_invites.class_id AND c.teacher_id = auth.uid())
  );

DROP POLICY IF EXISTS "Students can read own invites" ON class_invites;
CREATE POLICY "Students can read own invites" ON class_invites
  FOR SELECT USING (email = auth.email());
