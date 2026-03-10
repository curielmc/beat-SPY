-- Investment lessons library
CREATE TABLE IF NOT EXISTS investment_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  lesson_type text NOT NULL, -- 'diversification', 'risk', 'sector', 'long-term', 'personal_finance', etc.
  difficulty text NOT NULL DEFAULT 'basic' CHECK (difficulty IN ('basic', 'advanced')),
  created_at timestamptz DEFAULT now()
);

-- Track sent lessons to avoid duplicates
CREATE TABLE IF NOT EXISTS sent_lessons (
  lesson_id uuid REFERENCES investment_lessons(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL, -- user_id or group_id
  recipient_type text NOT NULL CHECK (recipient_type IN ('user', 'group')),
  sent_at timestamptz DEFAULT now(),
  PRIMARY KEY (lesson_id, recipient_id, recipient_type)
);

-- Allow system messages (null sender_id)
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;

-- Enable RLS on new tables
ALTER TABLE investment_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_lessons ENABLE ROW LEVEL SECURITY;

-- Everyone can read lessons
CREATE POLICY "Everyone can read lessons" ON investment_lessons
  FOR SELECT USING (true);

-- Admins can manage lessons
CREATE POLICY "Admins can manage lessons" ON investment_lessons
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Everyone can read their own sent lessons
CREATE POLICY "Users can read own sent lessons" ON sent_lessons
  FOR SELECT USING (
    (recipient_type = 'user' AND recipient_id = auth.uid()) OR
    (recipient_type = 'group' AND EXISTS (
      SELECT 1 FROM class_memberships cm
      WHERE cm.group_id = sent_lessons.recipient_id AND cm.user_id = auth.uid()
    ))
  );

-- Track each user's preferred difficulty level
CREATE TABLE IF NOT EXISTS user_lesson_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  difficulty text NOT NULL DEFAULT 'basic' CHECK (difficulty IN ('basic', 'advanced')),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_lesson_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lesson preference" ON user_lesson_preferences
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own lesson preference" ON user_lesson_preferences
  FOR ALL USING (user_id = auth.uid());

-- Seed some initial lessons
INSERT INTO investment_lessons (title, content, lesson_type) VALUES
('The Power of Diversification', 'Diversification is the strategy of spreading your investments across various assets, sectors, and industries. It helps reduce risk because if one investment performs poorly, others may perform well, balancing out your overall portfolio.', 'diversification'),
('Understanding Market Volatility', 'Volatility refers to how much a stock price swings up and down. While it can be scary, high volatility often presents opportunities for long-term investors. Remember: market fluctuations are normal and dont always mean a company is in trouble.', 'risk'),
('Compounding: Your Secret Weapon', 'Compound interest is the interest you earn on your interest. Over long periods, even small amounts of money can grow into significant wealth. The earlier you start investing, the more time compounding has to work its magic.', 'long-term'),
('Concentration Risk', 'Putting too much of your money into a single stock or sector (like Tech or Energy) is called concentration risk. While it can lead to high rewards if that stock takes off, it also means you could lose a large portion of your wealth if that specific area of the market crashes.', 'risk'),
('Emotional Investing vs. Strategy', 'Fear and greed are the two biggest enemies of an investor. Selling when you''re scared or buying because of FOMO (Fear Of Missing Out) often leads to losses. Stick to your long-term strategy and ignore the short-term noise.', 'strategy'),
('The Importance of Research', 'Never invest in a company you don''t understand. Look at their earnings, their products, and who their competitors are. Knowledge is your best defense against bad investments.', 'research'),
('Sector Rotation', 'The economy moves in cycles, and different sectors perform better at different times. For example, Utilities often do well during recessions, while Tech and Consumer Discretionary often lead during periods of growth.', 'sector'),
('Dollar-Cost Averaging', 'By investing a fixed amount of money at regular intervals (like every month), you buy more shares when prices are low and fewer when prices are high. This lowers your average cost per share over time and removes the stress of trying to "time the market."', 'strategy');
