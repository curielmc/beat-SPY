-- Consolidated training system migration (Tutorials, Steps, Progress, and Content)
-- This is idempotent and can be run on fresh or existing databases.

-- 1. Create Tables (with final naming)
CREATE TABLE IF NOT EXISTS training_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  category text CHECK (category IN ('investments', 'trading', 'economics', 'personal-finance')),
  thumbnail text,
  position integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS training_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_tutorial_id uuid REFERENCES training_tutorials(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  content text,
  position integer DEFAULT 0,
  duration_minutes integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE (training_tutorial_id, slug)
);

CREATE TABLE IF NOT EXISTS training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  training_step_id uuid REFERENCES training_steps(id) ON DELETE CASCADE NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, training_step_id)
);

CREATE TABLE IF NOT EXISTS class_training_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  training_tutorial_id uuid REFERENCES training_tutorials(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE (class_id, training_tutorial_id)
);

-- 2. Create Indexes
CREATE INDEX IF NOT EXISTS idx_training_tutorials_status ON training_tutorials(status);
CREATE INDEX IF NOT EXISTS idx_training_tutorials_slug ON training_tutorials(slug);
CREATE INDEX IF NOT EXISTS idx_training_steps_tutorial_id ON training_steps(training_tutorial_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_user_id ON training_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_training_progress_step_id ON training_progress(training_step_id);
CREATE INDEX IF NOT EXISTS idx_class_training_tutorials_class_id ON class_training_tutorials(class_id);
CREATE INDEX IF NOT EXISTS idx_class_training_tutorials_tutorial_id ON class_training_tutorials(training_tutorial_id);

-- 3. Enable RLS and Add Policies
ALTER TABLE training_tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_training_tutorials ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can read active training tutorials" ON training_tutorials;
    CREATE POLICY "Anyone can read active training tutorials" ON training_tutorials FOR SELECT USING (status = 'active' OR is_admin());

    DROP POLICY IF EXISTS "Admins can manage training tutorials" ON training_tutorials;
    CREATE POLICY "Admins can manage training tutorials" ON training_tutorials FOR ALL USING (is_admin());

    DROP POLICY IF EXISTS "Anyone can read training steps" ON training_steps;
    CREATE POLICY "Anyone can read training steps" ON training_steps FOR SELECT USING (EXISTS (SELECT 1 FROM training_tutorials tt WHERE tt.id = training_steps.training_tutorial_id AND (tt.status = 'active' OR is_admin())));

    DROP POLICY IF EXISTS "Admins can manage training steps" ON training_steps;
    CREATE POLICY "Admins can manage training steps" ON training_steps FOR ALL USING (is_admin());

    DROP POLICY IF EXISTS "Users can read own training progress" ON training_progress;
    CREATE POLICY "Users can read own training progress" ON training_progress FOR SELECT USING (user_id = auth.uid() OR is_admin());

    DROP POLICY IF EXISTS "Users can insert own training progress" ON training_progress;
    CREATE POLICY "Users can insert own training progress" ON training_progress FOR INSERT WITH CHECK (user_id = auth.uid());

    DROP POLICY IF EXISTS "Users can update own training progress" ON training_progress;
    CREATE POLICY "Users can update own training progress" ON training_progress FOR UPDATE USING (user_id = auth.uid());

    DROP POLICY IF EXISTS "Teachers can read student progress" ON training_progress;
    CREATE POLICY "Teachers can read student progress" ON training_progress FOR SELECT USING (EXISTS (SELECT 1 FROM class_memberships cm JOIN classes c ON c.id = cm.class_id WHERE cm.user_id = training_progress.user_id AND c.teacher_id = auth.uid()));

    DROP POLICY IF EXISTS "Teachers can manage their class tutorials" ON class_training_tutorials;
    CREATE POLICY "Teachers can manage their class tutorials" ON class_training_tutorials FOR ALL USING (is_teacher_of_class(class_id) OR is_admin());

    DROP POLICY IF EXISTS "Students can read class tutorials" ON class_training_tutorials;
    CREATE POLICY "Students can read class tutorials" ON class_training_tutorials FOR SELECT USING (is_member_of_class(class_id));
END $$;

-- 4. Teacher Invite Codes Table (If missing)
CREATE TABLE IF NOT EXISTS teacher_invite_codes (
    code text PRIMARY KEY,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- 5. Insert "Fundamentals of Investing" Tutorial Content
DO $$
DECLARE
    tutorial_id uuid;
BEGIN
    INSERT INTO training_tutorials (title, slug, description, category, position, status)
    VALUES (
        'Fundamentals of Investing',
        'fundamentals-of-investing',
        'A high school guide to understanding investing, markets, and how to beat the S&P 500.',
        'investments',
        1,
        'active'
    )
    ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        category = EXCLUDED.category
    RETURNING id INTO tutorial_id;

    DELETE FROM training_steps WHERE training_tutorial_id = tutorial_id;

    INSERT INTO training_steps (training_tutorial_id, title, slug, content, position, duration_minutes)
    VALUES
    (tutorial_id, 'Welcome to Beat the S&P 500', 'welcome', 
        '<div class="space-y-4">
            <p>Welcome to the Beat the S&P 500 challenge! This tutorial will guide you through the basics of investing and how to use this application to build your own portfolio.</p>
            <div class="bg-base-200 p-4 rounded-lg">
                <h3 class="font-bold mb-2">Why are we here?</h3>
                <ul class="list-disc list-inside space-y-1">
                    <li>Why does investing matter?</li>
                    <li>What do you hope to learn?</li>
                    <li>What have you heard about investing?</li>
                </ul>
            </div>
            <p>Investing decisions will be a part of your life, no matter your career. From your first job''s 401(k) plan to real estate dreams, understanding these concepts is an inevitable part of life.</p>
        </div>', 1, 3),

    (tutorial_id, 'Why Investing Matters', 'why-investing-matters', 
        '<div class="space-y-4">
            <h3 class="text-xl font-bold text-error">The Problem: Inflation</h3>
            <p>Money sitting still loses value. Inflation averages 2–3% annually, meaning your purchasing power shrinks every year. $100 today is roughly $94 in purchasing power in just 2 years.</p>
            
            <h3 class="text-xl font-bold text-success">The Solution: Investing</h3>
            <p>Investing puts your money to work—growing wealth beyond what you can earn alone. Common goals include:</p>
            <ul class="list-disc list-inside">
                <li>Beat inflation to preserve purchasing power</li>
                <li>Fund future needs (retirement, home, education)</li>
                <li>Build passive income (earn while you sleep)</li>
            </ul>
        </div>', 2, 5),

    (tutorial_id, 'The "Beat the S&P 500" Framework', 'framework', 
        '<div class="space-y-4">
            <p>We use the S&P 500 as our framework for three main reasons:</p>
            <ol class="list-decimal list-inside space-y-2">
                <li><strong>The Gold Standard:</strong> It''s one of the most common investments in the world.</li>
                <li><strong>Hard to Beat:</strong> Over 15 years, ~90% of professional managers underperform it.</li>
                <li><strong>Learning Framework:</strong> It''s a great launching pad to measure your decisions.</li>
            </ol>
            <div class="divider"></div>
            <h3 class="font-bold">The Cashflow Quadrant</h3>
            <p>In Robert Kiyosaki''s framework, the goal is to move towards the <strong>I (Investor)</strong> quadrant, where money works for you without your direct involvement.</p>
        </div>', 3, 5),

    (tutorial_id, 'Core Concepts: Returns & Compounding', 'returns-compounding', 
        '<div class="space-y-4">
            <div class="stats shadow w-full">
                <div class="stat">
                    <div class="stat-title">Rate of Return (RoR)</div>
                    <div class="stat-value text-primary text-2xl">Gain / Initial Investment</div>
                    <div class="stat-desc">Ex: $1,000 becomes $1,100 = 10% return</div>
                </div>
            </div>
            
            <h3 class="text-lg font-bold">The Power of Compound Interest</h3>
            <p>Compound interest means you earn interest on your interest. The longer you wait, the faster your money grows!</p>
            
            <div class="bg-info bg-opacity-10 p-4 rounded-lg">
                <h4 class="font-bold">The Rule of 72</h4>
                <p>A quick shortcut to estimate how long it takes your money to double:</p>
                <p class="text-center font-mono text-xl my-2">72 ÷ Interest Rate = Years to Double</p>
                <p>At 8% (Stock Market Average), your money doubles every 9 years.</p>
            </div>
        </div>', 4, 6),

    (tutorial_id, 'How Markets Work', 'how-markets-work', 
        '<div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
                <div class="card bg-base-200 p-3">
                    <span class="font-bold">Debt (Borrow)</span>
                    <span class="text-sm">You take a loan and pay it back with interest.</span>
                </div>
                <div class="card bg-base-200 p-3">
                    <span class="font-bold">Equity (Sell)</span>
                    <span class="text-sm">You sell a piece of ownership (shares) for cash.</span>
                </div>
            </div>
            
            <h3 class="font-bold">What is a Stock?</h3>
            <p>A stock is your ownership in a company. A <strong>share</strong> is one single unit of that stock. When you buy 10 shares of Apple, you own 10 units of Apple stock.</p>
            
            <h3 class="font-bold">How do you make money?</h3>
            <ul class="list-disc list-inside">
                <li><strong>Capital Gains:</strong> Buying low and selling high.</li>
                <li><strong>Dividends:</strong> A regular bonus just for owning a piece of the company.</li>
            </ul>
        </div>', 5, 5),

    (tutorial_id, 'S&P 500 & Stock Indices', 'indices', 
        '<div class="space-y-4">
            <p>A stock index tracks the performance of a group of stocks as one single number—like a scoreboard for investing.</p>
            <ul class="space-y-2">
                <li><strong>S&P 500:</strong> 500 largest U.S. companies.</li>
                <li><strong>Dow Jones (DJIA):</strong> 30 major U.S. companies (Apple, Disney, etc).</li>
                <li><strong>NASDAQ:</strong> Heavy focus on tech companies (Google, Meta, etc).</li>
            </ul>
            <div class="bg-base-200 p-4 rounded-lg">
                <h4 class="font-bold mb-2">The "Big Five" in the S&P 500</h4>
                <p class="text-sm">Apple, Microsoft, NVIDIA, Amazon, and Alphabet make up ~28% of the entire index. When they move, the whole index moves.</p>
            </div>
        </div>', 6, 4),

    (tutorial_id, 'Getting Started', 'getting-started', 
        '<div class="space-y-4">
            <h3 class="text-xl font-bold">Your Next Steps</h3>
            <ol class="list-decimal list-inside space-y-2">
                <li>Use your own knowledge + AI tools to research stocks.</li>
                <li>Decide on up to 5 stocks from the S&P 500 list.</li>
                <li>Buy your shares on the Beat the S&P 500 app.</li>
                <li>Share your rationale with the class!</li>
            </ol>
            <div class="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>Remember: The goal is to beat the benchmark (SPY), but great thinking is what matters most!</span>
            </div>
        </div>', 7, 3);
END $$;
