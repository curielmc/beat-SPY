-- Beat the S&P - Initial Schema Migration
-- Run this in the Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- profiles: extends Supabase Auth users
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  avatar_url text,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
  created_at timestamptz DEFAULT now()
);

-- classes: a teacher's class
CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid REFERENCES profiles(id) NOT NULL,
  code text UNIQUE NOT NULL,
  class_name text NOT NULL,
  school text,
  group_mode text DEFAULT 'student_choice' CHECK (group_mode IN ('student_choice', 'teacher_assign')),
  approval_code text,
  restrictions jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- groups: teams within a class
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- class_memberships: students in classes/groups
CREATE TABLE class_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  group_id uuid REFERENCES groups(id) ON DELETE SET NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE(user_id, class_id)
);

-- blocked_emails: kicked students
CREATE TABLE blocked_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  blocked_at timestamptz DEFAULT now(),
  UNIQUE(class_id, email)
);

-- portfolios: one per group (class context) or per user (independent)
CREATE TABLE portfolios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('group', 'user')),
  owner_id uuid NOT NULL,
  starting_cash numeric DEFAULT 100000,
  cash_balance numeric DEFAULT 100000,
  created_at timestamptz DEFAULT now()
);

-- holdings: current positions
CREATE TABLE holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  ticker text NOT NULL,
  shares numeric NOT NULL,
  avg_cost numeric NOT NULL,
  UNIQUE(portfolio_id, ticker)
);

-- trades: trade history log
CREATE TABLE trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  ticker text NOT NULL,
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  dollars numeric NOT NULL,
  shares numeric NOT NULL,
  price numeric NOT NULL,
  executed_at timestamptz DEFAULT now()
);

-- benchmark_holdings: SPY mirror positions
CREATE TABLE benchmark_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  ticker text DEFAULT 'SPY',
  shares numeric NOT NULL,
  avg_cost numeric NOT NULL
);

-- benchmark_trades: SPY mirror trade log
CREATE TABLE benchmark_trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id uuid REFERENCES portfolios(id) ON DELETE CASCADE NOT NULL,
  ticker text DEFAULT 'SPY',
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  dollars numeric NOT NULL,
  shares numeric NOT NULL,
  price numeric NOT NULL,
  executed_at timestamptz DEFAULT now()
);

-- notifications: bonus cash awards
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  seen_by uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_classes_code ON classes(code);
CREATE INDEX idx_groups_class_id ON groups(class_id);
CREATE INDEX idx_class_memberships_user_id ON class_memberships(user_id);
CREATE INDEX idx_class_memberships_class_id ON class_memberships(class_id);
CREATE INDEX idx_class_memberships_group_id ON class_memberships(group_id);
CREATE INDEX idx_portfolios_owner ON portfolios(owner_type, owner_id);
CREATE INDEX idx_holdings_portfolio_id ON holdings(portfolio_id);
CREATE INDEX idx_trades_portfolio_id ON trades(portfolio_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_benchmark_holdings_portfolio_id ON benchmark_holdings(portfolio_id);
CREATE INDEX idx_benchmark_trades_portfolio_id ON benchmark_trades(portfolio_id);
CREATE INDEX idx_notifications_group_id ON notifications(group_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: check if user is teacher of a class
CREATE OR REPLACE FUNCTION is_teacher_of_class(class_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM classes WHERE id = class_uuid AND teacher_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Helper function: check if user is member of a class
CREATE OR REPLACE FUNCTION is_member_of_class(class_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM class_memberships WHERE class_id = class_uuid AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- PROFILES policies
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid() OR is_admin());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "Teachers can read students in their classes" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_memberships cm
      JOIN classes c ON c.id = cm.class_id
      WHERE cm.user_id = profiles.id AND c.teacher_id = auth.uid()
    )
  );

-- CLASSES policies
CREATE POLICY "Teachers can manage own classes" ON classes
  FOR ALL USING (teacher_id = auth.uid() OR is_admin());

CREATE POLICY "Students can read classes they are in" ON classes
  FOR SELECT USING (
    is_member_of_class(id) OR is_admin()
  );

CREATE POLICY "Anyone authenticated can read class by code" ON classes
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- GROUPS policies
CREATE POLICY "Teachers can manage groups in their classes" ON groups
  FOR ALL USING (
    is_teacher_of_class(class_id) OR is_admin()
  );

CREATE POLICY "Members can read groups in their class" ON groups
  FOR SELECT USING (
    is_member_of_class(class_id)
  );

CREATE POLICY "Members can insert groups in student_choice classes" ON groups
  FOR INSERT WITH CHECK (
    is_member_of_class(class_id) AND
    EXISTS (SELECT 1 FROM classes WHERE id = class_id AND group_mode = 'student_choice')
  );

-- CLASS_MEMBERSHIPS policies
CREATE POLICY "Teachers can manage memberships in their classes" ON class_memberships
  FOR ALL USING (
    is_teacher_of_class(class_id) OR is_admin()
  );

CREATE POLICY "Users can read own memberships" ON class_memberships
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own membership" ON class_memberships
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- BLOCKED_EMAILS policies
CREATE POLICY "Teachers can manage blocked emails" ON blocked_emails
  FOR ALL USING (
    is_teacher_of_class(class_id) OR is_admin()
  );

CREATE POLICY "Anyone can check blocked emails for their class" ON blocked_emails
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- PORTFOLIOS policies
CREATE POLICY "Portfolio access for group members and teachers" ON portfolios
  FOR SELECT USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'group' AND EXISTS (
      SELECT 1 FROM class_memberships cm
      WHERE cm.group_id = portfolios.owner_id AND cm.user_id = auth.uid()
    )) OR
    (owner_type = 'group' AND EXISTS (
      SELECT 1 FROM groups g
      JOIN classes c ON c.id = g.class_id
      WHERE g.id = portfolios.owner_id AND c.teacher_id = auth.uid()
    )) OR
    is_admin()
  );

CREATE POLICY "Portfolio insert for group members" ON portfolios
  FOR INSERT WITH CHECK (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Portfolio update for group members and teachers" ON portfolios
  FOR UPDATE USING (
    (owner_type = 'user' AND owner_id = auth.uid()) OR
    (owner_type = 'group' AND EXISTS (
      SELECT 1 FROM class_memberships cm
      WHERE cm.group_id = portfolios.owner_id AND cm.user_id = auth.uid()
    )) OR
    (owner_type = 'group' AND EXISTS (
      SELECT 1 FROM groups g
      JOIN classes c ON c.id = g.class_id
      WHERE g.id = portfolios.owner_id AND c.teacher_id = auth.uid()
    )) OR
    is_admin()
  );

-- HOLDINGS policies
CREATE POLICY "Holdings follow portfolio access" ON holdings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = holdings.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

-- TRADES policies
CREATE POLICY "Trades follow portfolio access" ON trades
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = trades.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

CREATE POLICY "Group members can insert trades" ON trades
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = trades.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        ))
      )
    )
  );

-- BENCHMARK policies (same as holdings/trades)
CREATE POLICY "Benchmark holdings follow portfolio access" ON benchmark_holdings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = benchmark_holdings.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

CREATE POLICY "Benchmark trades follow portfolio access" ON benchmark_trades
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM portfolios p WHERE p.id = benchmark_trades.portfolio_id AND (
        (p.owner_type = 'user' AND p.owner_id = auth.uid()) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM class_memberships cm
          WHERE cm.group_id = p.owner_id AND cm.user_id = auth.uid()
        )) OR
        (p.owner_type = 'group' AND EXISTS (
          SELECT 1 FROM groups g
          JOIN classes c ON c.id = g.class_id
          WHERE g.id = p.owner_id AND c.teacher_id = auth.uid()
        )) OR
        is_admin()
      )
    )
  );

-- NOTIFICATIONS policies
CREATE POLICY "Group members can read notifications" ON notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_memberships cm
      WHERE cm.group_id = notifications.group_id AND cm.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM groups g
      JOIN classes c ON c.id = g.class_id
      WHERE g.id = notifications.group_id AND c.teacher_id = auth.uid()
    ) OR
    is_admin()
  );

CREATE POLICY "Teachers can insert notifications" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN classes c ON c.id = g.class_id
      WHERE g.id = notifications.group_id AND c.teacher_id = auth.uid()
    ) OR
    is_admin()
  );

CREATE POLICY "Users can update notifications they've seen" ON notifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM class_memberships cm
      WHERE cm.group_id = notifications.group_id AND cm.user_id = auth.uid()
    )
  );

-- ============================================
-- TRIGGER: Auto-create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
