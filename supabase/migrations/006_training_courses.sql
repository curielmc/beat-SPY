-- Training Courses System
-- Courses -> Modules structure with progress tracking
-- Teachers select courses from a library to assign to their classes

-- ============================================
-- TABLES
-- ============================================

-- training_courses: the course library
CREATE TABLE training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  category text CHECK (category IN ('investments', 'trading', 'economics', 'personal-finance')),
  thumbnail text,
  position integer DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(slug)
);

-- training_modules: lessons within a course
CREATE TABLE training_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_course_id uuid REFERENCES training_courses(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  description text,
  content text,
  position integer DEFAULT 0,
  duration_minutes integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(training_course_id, slug)
);

-- training_progress: tracks which modules a user has completed
CREATE TABLE training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  training_module_id uuid REFERENCES training_modules(id) ON DELETE CASCADE NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, training_module_id)
);

-- class_training_courses: which courses a teacher has assigned to their class
CREATE TABLE class_training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  training_course_id uuid REFERENCES training_courses(id) ON DELETE CASCADE NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(class_id, training_course_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_training_courses_status ON training_courses(status);
CREATE INDEX idx_training_courses_slug ON training_courses(slug);
CREATE INDEX idx_training_modules_course_id ON training_modules(training_course_id);
CREATE INDEX idx_training_progress_user_id ON training_progress(user_id);
CREATE INDEX idx_training_progress_module_id ON training_progress(training_module_id);
CREATE INDEX idx_class_training_courses_class_id ON class_training_courses(class_id);
CREATE INDEX idx_class_training_courses_course_id ON class_training_courses(training_course_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE training_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_training_courses ENABLE ROW LEVEL SECURITY;

-- Training courses: anyone authenticated can read active courses
CREATE POLICY "Anyone can read active training courses" ON training_courses
  FOR SELECT USING (status = 'active' OR is_admin());

-- Admins can manage courses
CREATE POLICY "Admins can manage training courses" ON training_courses
  FOR ALL USING (is_admin());

-- Training modules: anyone can read modules of active courses
CREATE POLICY "Anyone can read training modules" ON training_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM training_courses tc
      WHERE tc.id = training_modules.training_course_id
      AND (tc.status = 'active' OR is_admin())
    )
  );

CREATE POLICY "Admins can manage training modules" ON training_modules
  FOR ALL USING (is_admin());

-- Training progress: users can manage their own progress
CREATE POLICY "Users can read own training progress" ON training_progress
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users can insert own training progress" ON training_progress
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own training progress" ON training_progress
  FOR UPDATE USING (user_id = auth.uid());

-- Teachers can view progress of students in their classes
CREATE POLICY "Teachers can read student progress" ON training_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM class_memberships cm
      JOIN classes c ON c.id = cm.class_id
      WHERE cm.user_id = training_progress.user_id
      AND c.teacher_id = auth.uid()
    )
  );

-- Class training courses: teachers manage their class assignments
CREATE POLICY "Teachers can manage their class training courses" ON class_training_courses
  FOR ALL USING (
    is_teacher_of_class(class_id) OR is_admin()
  );

-- Students can see courses assigned to their class
CREATE POLICY "Students can read class training courses" ON class_training_courses
  FOR SELECT USING (
    is_member_of_class(class_id)
  );

-- ============================================
-- SEED: Fundamentals of Investing Course
-- ============================================

INSERT INTO training_courses (title, slug, description, category, position, status) VALUES
(
  'Fundamentals of Investing',
  'fundamentals-of-investing',
  'A comprehensive introduction to investing covering why you should invest, different investment types, compound interest, risk management, and how to get started building your portfolio.',
  'investments',
  1,
  'active'
);

-- Get the course ID for module inserts
DO $$
DECLARE
  course_id uuid;
BEGIN
  SELECT id INTO course_id FROM training_courses WHERE slug = 'fundamentals-of-investing';

  INSERT INTO training_modules (training_course_id, title, slug, description, content, position, duration_minutes) VALUES
  (
    course_id,
    'Why Invest?',
    'why-invest',
    'Understand why investing matters and the challenge of inflation on your money over time.',
    '<div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-primary mb-4">The Challenge of Money Over Time</h2>
        <p class="text-base-content/80 leading-relaxed">Money not invested is actually losing value. Inflation averages 2-3% annually, meaning <strong>your purchasing power decreases year after year</strong> if your money isn''t growing.</p>
        <p class="text-base-content/80 leading-relaxed mt-3">Simply saving is not enough for long-term financial security. <strong>Investing is how you build and grow wealth beyond your earning capacity.</strong></p>
      </div>
      <div class="bg-base-200 rounded-lg p-5">
        <h3 class="font-semibold text-lg mb-3">Common Goals</h3>
        <ul class="list-disc list-inside space-y-2 text-base-content/80">
          <li>Beat inflation (preserve purchasing power)</li>
          <li>Fund future needs (replace income)</li>
          <li><strong>Build passive income streams</strong></li>
        </ul>
      </div>
      <div class="alert alert-info">
        <span>Money sitting idle is actually losing value. Inflation averages 2-3% annually, meaning your purchasing power decreases year after year if your money isn''t growing.</span>
      </div>
    </div>',
    1,
    5
  ),
  (
    course_id,
    'The Cashflow Quadrant',
    'cashflow-quadrant',
    'Learn about the four ways to earn income from Robert Kiyosaki''s Rich Dad, Poor Dad.',
    '<div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-primary mb-2">The Cashflow Quadrant: Path to Financial Freedom</h2>
        <p class="text-base-content/60 mb-4">From Robert Kiyosaki''s <em>Rich Dad, Poor Dad</em></p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">E: Employee</h3>
            <p class="text-sm text-base-content/70">Trading time for money with limited upside. You work for someone else''s system and receive a paycheck.</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">S: Self-employed</h3>
            <p class="text-sm text-base-content/70">You own your job but are limited by your own time and energy (e.g. Plumber without employees)</p>
          </div>
        </div>
        <div class="card bg-primary/10 border border-primary/30">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg text-primary">I: Investor</h3>
            <p class="text-sm text-base-content/70">Money works for you without your involvement.</p>
          </div>
        </div>
        <div class="card bg-primary/10 border border-primary/30">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg text-primary">B: Business Owner</h3>
            <p class="text-sm text-base-content/70">Creating systems that generate income without your direct time (e.g. my Dad)</p>
          </div>
        </div>
      </div>
      <div class="alert alert-success">
        <span>The <strong>key to financial freedom</strong> is moving from Employee/Self-Employed to Investor/Business Owner</span>
      </div>
    </div>',
    2,
    5
  ),
  (
    course_id,
    'The Power of Compound Interest',
    'compound-interest',
    'Discover how compound interest can grow your wealth exponentially over time.',
    '<div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-primary mb-4">The Power of Compound Interest</h2>
        <blockquote class="border-l-4 border-primary pl-4 italic text-base-content/70">
          "Compound interest is the 8th wonder of the world. He who understands it, earns it; he who doesn''t, pays it."
          <footer class="mt-1 not-italic text-sm">— Albert Einstein</footer>
        </blockquote>
      </div>
      <p class="text-base-content/80 leading-relaxed">Compound interest means earning returns not just on your initial investment, but also on the returns you''ve already earned. This creates an <strong>exponential growth curve</strong> that accelerates over time.</p>
      <div class="bg-base-200 rounded-lg p-5">
        <h3 class="font-semibold text-lg mb-3">Example</h3>
        <p class="mb-3">$10,000 invested at 8% annual return:</p>
        <div class="overflow-x-auto">
          <table class="table table-sm">
            <thead><tr><th>Timeframe</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>After 9 years</td><td class="font-semibold">~$20,000</td></tr>
              <tr><td>After 18 years</td><td class="font-semibold">~$40,000</td></tr>
              <tr><td>After 27 years</td><td class="font-semibold">~$80,000</td></tr>
              <tr><td>After 36 years</td><td class="font-semibold">~$160,000</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="alert alert-info">
        <span>It goes up quickly, because <strong>money grows on itself</strong></span>
      </div>
    </div>',
    3,
    5
  ),
  (
    course_id,
    'The Rule of 72',
    'rule-of-72',
    'A simple mental shortcut to estimate how long it takes for your investment to double.',
    '<div class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold text-primary mb-4">The Rule of 72</h2>
        <p class="text-base-content/80 leading-relaxed">The Rule of 72 is a mental shortcut that helps you estimate how long it will take for your investment to double, based on a fixed annual rate of return.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="card bg-base-200 text-center">
          <div class="card-body p-4">
            <div class="text-3xl font-bold text-primary">72 &divide; 4%</div>
            <div class="text-xl font-semibold">18 years</div>
            <p class="text-xs text-base-content/60">Conservative investments (Savings accounts today)</p>
          </div>
        </div>
        <div class="card bg-base-200 text-center">
          <div class="card-body p-4">
            <div class="text-3xl font-bold text-primary">72 &divide; 8%</div>
            <div class="text-xl font-semibold">9 years</div>
            <p class="text-xs text-base-content/60">Average stock market annual return</p>
          </div>
        </div>
        <div class="card bg-base-200 text-center">
          <div class="card-body p-4">
            <div class="text-3xl font-bold text-primary">72 &divide; 12%</div>
            <div class="text-xl font-semibold">6 years</div>
            <p class="text-xs text-base-content/60">High-growth investments (like Tech stocks)</p>
          </div>
        </div>
      </div>
      <div class="alert alert-success">
        <span>The higher the return rate, the faster your money doubles. But remember: higher returns usually come with higher risk!</span>
      </div>
    </div>',
    4,
    5
  ),
  (
    course_id,
    'Investment Types: Building Your Portfolio',
    'investment-types',
    'Explore the four main types of investments: Stocks, Bonds, Real Estate, and Funds.',
    '<div class="space-y-6">
      <h2 class="text-2xl font-bold text-primary mb-4">Investment Types: Building Your Portfolio</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">Stocks</h3>
            <p class="text-sm text-base-content/70">Ownership shares in a company. Potential for high returns through price appreciation and dividends, but with higher volatility.</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">Bonds</h3>
            <p class="text-sm text-base-content/70">Loans to companies or governments. Generally more stable with regular interest payments, but typically lower returns than stocks.</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">Real Estate</h3>
            <p class="text-sm text-base-content/70">Property investments that can generate rental income and appreciate in value. Offers tangible assets but requires more capital and management.</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">Funds (ETFs & Mutual Funds)</h3>
            <p class="text-sm text-base-content/70">Professionally managed collections of investments. ETFs and mutual funds offer instant diversification across multiple assets with a single purchase.</p>
          </div>
        </div>
      </div>
    </div>',
    5,
    5
  ),
  (
    course_id,
    'Risk vs. Reward: Finding Your Balance',
    'risk-vs-reward',
    'Understand risk tolerance and how different investments carry different levels of risk and return.',
    '<div class="space-y-6">
      <h2 class="text-2xl font-bold text-primary mb-4">Risk vs. Reward: Finding Your Balance</h2>
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead>
            <tr><th>Asset Type</th><th>Potential Return</th><th>Potential Loss</th><th>Risk Level</th></tr>
          </thead>
          <tbody>
            <tr><td>Cash / Savings</td><td class="text-success">Low</td><td class="text-success">Very Low</td><td><div class="badge badge-success badge-sm">Low</div></td></tr>
            <tr><td>Bonds</td><td>Low-Medium</td><td>Low</td><td><div class="badge badge-info badge-sm">Low-Med</div></td></tr>
            <tr><td>Funds (ETFs)</td><td>Medium</td><td>Medium</td><td><div class="badge badge-warning badge-sm">Medium</div></td></tr>
            <tr><td>Real Estate</td><td>Medium-High</td><td>Medium</td><td><div class="badge badge-warning badge-sm">Medium</div></td></tr>
            <tr><td>Single Stocks</td><td class="text-error">High</td><td class="text-error">High</td><td><div class="badge badge-error badge-sm">High</div></td></tr>
          </tbody>
        </table>
      </div>
      <div class="bg-base-200 rounded-lg p-5">
        <h3 class="font-semibold text-lg mb-3">Understanding Risk Tolerance</h3>
        <p class="text-base-content/80 mb-3">Risk tolerance is your personal comfort level with the possibility of losing money in exchange for potential gains. It''s influenced by:</p>
        <ul class="list-disc list-inside space-y-1 text-base-content/70">
          <li>Your age and time horizon</li>
          <li>Financial goals and needs</li>
          <li>Emotional response to market fluctuations</li>
          <li>Overall financial situation</li>
        </ul>
      </div>
    </div>',
    6,
    8
  ),
  (
    course_id,
    'The Value of Starting Early',
    'starting-early',
    'See how starting to invest early can make a massive difference through real examples.',
    '<div class="space-y-6">
      <h2 class="text-2xl font-bold text-primary mb-4">The Value of Starting Early: Time is Your Greatest Asset</h2>
      <p class="text-base-content/80 leading-relaxed"><strong>Time in the market beats timing the market.</strong> Even small contributions can grow significantly when given enough time to compound.</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-success/10 border border-success/30">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg text-success">Early Emily</h3>
            <ul class="text-sm space-y-1 text-base-content/70">
              <li>Invests $5,000 annually from age 25-35</li>
              <li>Total invested: <strong>$50,000</strong></li>
              <li>Value at age 65: <strong class="text-success text-lg">$787,000</strong></li>
            </ul>
          </div>
        </div>
        <div class="card bg-error/10 border border-error/30">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg text-error">Late Larry</h3>
            <ul class="text-sm space-y-1 text-base-content/70">
              <li>Invests $5,000 annually from age 35-65</li>
              <li>Total invested: <strong>$150,000</strong></li>
              <li>Value at age 65: <strong class="text-error text-lg">$611,000</strong></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="alert alert-success">
        <span>Emily invested <strong>$100,000 less</strong> than Larry but ended up with <strong>$176,000 more</strong>! The best strategy is starting now.</span>
      </div>
    </div>',
    7,
    5
  ),
  (
    course_id,
    'Common Mistakes to Avoid',
    'common-mistakes',
    'Learn about the most common investing mistakes and how to avoid them.',
    '<div class="space-y-6">
      <h2 class="text-2xl font-bold text-primary mb-4">Common Mistakes to Avoid</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">Trying to Time the Market</h3>
            <p class="text-sm text-base-content/70">Even professional investors struggle to consistently predict market movements. Research shows that missing just the 10 best market days over a 20-year period can cut your returns in half.</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">Investing Without a Plan</h3>
            <p class="text-sm text-base-content/70">Without clear goals and a strategy, you''re more likely to make emotional decisions. Create a written investment plan that outlines your goals, time horizon, risk tolerance, and asset allocation.</p>
          </div>
        </div>
      </div>
      <div class="card bg-base-200">
        <div class="card-body p-4">
          <h3 class="font-bold text-lg">Following the Crowd</h3>
          <p class="text-sm text-base-content/70">The herd mentality often leads investors to buy high and sell low. When everyone is excited about an investment, prices are often inflated. When fear takes over, valuable opportunities may be overlooked.</p>
        </div>
      </div>
      <blockquote class="border-l-4 border-primary pl-4 italic text-base-content/70">
        "Simplicity is the ultimate sophistication. Consistency beats complexity in investing."
      </blockquote>
    </div>',
    8,
    5
  ),
  (
    course_id,
    'Getting Started: Your Path to Investment Success',
    'getting-started',
    'Practical steps to begin your investing journey today.',
    '<div class="space-y-6">
      <h2 class="text-2xl font-bold text-primary mb-4">Getting Started: Your Path to Investment Success</h2>
      <div class="space-y-4">
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">1. Start Today, Not Tomorrow</h3>
            <p class="text-sm text-base-content/70">Don''t wait for the "perfect" moment or to learn everything first. Open an investment account and make your first purchase today, even if it''s just $25.</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">2. Learn by Doing</h3>
            <p class="text-sm text-base-content/70">You''ll learn more about investing in your first month with real money than in years of reading books. Experience beats theory every time.</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">3. Accept You Won''t Know Everything</h3>
            <p class="text-sm text-base-content/70">No investor knows everything - not even the professionals. Embrace the learning process and don''t let perfectionism paralyze you.</p>
          </div>
        </div>
        <div class="card bg-base-200">
          <div class="card-body p-4">
            <h3 class="font-bold text-lg">4. Start Small, Start Now</h3>
            <p class="text-sm text-base-content/70">Begin with whatever amount you can afford to lose. The key is starting, not starting big. You can always increase your investments as you learn.</p>
          </div>
        </div>
      </div>
    </div>',
    9,
    5
  ),
  (
    course_id,
    'Course Summary & Quiz',
    'summary-quiz',
    'Review the key concepts and test your understanding.',
    '<div class="space-y-6">
      <h2 class="text-2xl font-bold text-primary mb-4">Course Summary</h2>
      <div class="bg-base-200 rounded-lg p-5">
        <h3 class="font-semibold text-lg mb-3">Key Takeaways</h3>
        <ul class="list-disc list-inside space-y-2 text-base-content/80">
          <li><strong>Inflation erodes savings</strong> — investing is necessary to maintain and grow wealth</li>
          <li><strong>Compound interest</strong> is your most powerful tool — start early to maximize its effect</li>
          <li><strong>The Rule of 72</strong> helps estimate how quickly investments double</li>
          <li><strong>Diversification</strong> across stocks, bonds, real estate, and funds reduces risk</li>
          <li><strong>Risk and reward</strong> are correlated — understand your tolerance</li>
          <li><strong>Time in the market</strong> beats timing the market</li>
          <li><strong>Avoid common mistakes</strong>: emotional decisions, no plan, following the crowd</li>
          <li><strong>Start now</strong> with whatever you can — the best time to invest is today</li>
        </ul>
      </div>
      <div class="alert alert-info">
        <span>Congratulations on completing the Fundamentals of Investing course! Now go apply what you''ve learned in your Beat the S&P 500 portfolio.</span>
      </div>
    </div>',
    10,
    5
  );
END $$;
