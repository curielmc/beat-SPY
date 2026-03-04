-- In-app messaging: teacher → group/individual/class
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) NOT NULL,
  recipient_type text NOT NULL CHECK (recipient_type IN ('group', 'user', 'class')),
  recipient_id uuid, -- group_id or user_id; null when recipient_type = 'class'
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_class ON messages(class_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can send messages" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

CREATE POLICY "Teachers can read all messages" ON messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

CREATE POLICY "Students can read their messages" ON messages
  FOR SELECT USING (
    (recipient_type = 'user' AND recipient_id = auth.uid()) OR
    (recipient_type = 'group' AND recipient_id IN (
      SELECT group_id FROM class_memberships
      WHERE user_id = auth.uid() AND group_id IS NOT NULL
    )) OR
    (recipient_type = 'class' AND class_id IN (
      SELECT class_id FROM class_memberships WHERE user_id = auth.uid()
    ))
  );

-- Read receipts
CREATE TABLE IF NOT EXISTS message_reads (
  message_id uuid REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  read_at timestamptz DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can mark read" ON message_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own receipts" ON message_reads
  FOR SELECT USING (user_id = auth.uid());

-- Enable realtime on messages
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
