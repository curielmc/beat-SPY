-- Newsletter feature: drafts, sends, unsubscribes, parent signups.

-- Stable per-user token used for unsubscribe links.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS newsletter_token text UNIQUE;

UPDATE profiles
SET newsletter_token = encode(gen_random_bytes(16), 'hex')
WHERE newsletter_token IS NULL;

ALTER TABLE profiles
  ALTER COLUMN newsletter_token SET DEFAULT encode(gen_random_bytes(16), 'hex'),
  ALTER COLUMN newsletter_token SET NOT NULL;

-- Public slug for the parent signup page.
ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS public_slug text UNIQUE;

UPDATE classes
SET public_slug = lower(replace(replace(class_name, ' ', '-'), '/', '-')) || '-' || substr(id::text, 1, 6)
WHERE public_slug IS NULL;

-- Newsletters: one row per draft/sent newsletter.
CREATE TABLE IF NOT EXISTS newsletters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  teacher_id uuid REFERENCES profiles(id) NOT NULL,
  subject text NOT NULL,
  intro_html text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent')),
  sent_at timestamptz,
  recipients_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_newsletters_class_created
  ON newsletters(class_id, created_at DESC);

ALTER TABLE newsletters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage their class newsletters" ON newsletters
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = newsletters.class_id AND c.teacher_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = newsletters.class_id AND c.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage all newsletters" ON newsletters
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- Student unsubscribes (per class).
CREATE TABLE IF NOT EXISTS newsletter_unsubscribes (
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE,
  unsubscribed_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, class_id)
);

ALTER TABLE newsletter_unsubscribes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own unsubscribes" ON newsletter_unsubscribes
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Teachers see unsubscribes in their classes" ON newsletter_unsubscribes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = newsletter_unsubscribes.class_id AND c.teacher_id = auth.uid()
    )
  );

-- Parent subscribers (public signup, double opt-in).
CREATE TABLE IF NOT EXISTS newsletter_parent_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  email text NOT NULL,
  parent_name text,
  student_name text,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (class_id, email)
);

CREATE INDEX IF NOT EXISTS idx_parent_subs_class
  ON newsletter_parent_subscribers(class_id) WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;

ALTER TABLE newsletter_parent_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers see parent subs for their classes" ON newsletter_parent_subscribers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.id = newsletter_parent_subscribers.class_id AND c.teacher_id = auth.uid()
    )
  );
-- Inserts/updates go through service-key endpoints, so no public policies needed.
