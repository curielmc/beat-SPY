-- Make email optional for roster-style uploads (no email, just name/grade/group)
ALTER TABLE class_invites ALTER COLUMN email DROP NOT NULL;

-- Add grade column
ALTER TABLE class_invites ADD COLUMN IF NOT EXISTS grade text;

-- Add group_name to track intended group assignment
ALTER TABLE class_invites ADD COLUMN IF NOT EXISTS group_name text;

-- Drop the old unique constraint and replace with one that handles nulls
ALTER TABLE class_invites DROP CONSTRAINT IF EXISTS class_invites_class_id_email_key;

-- New unique constraint: if email is present, unique per class; otherwise allow duplicates
-- Use a unique index with COALESCE to handle nulls
CREATE UNIQUE INDEX IF NOT EXISTS class_invites_class_id_email_unique
  ON class_invites (class_id, COALESCE(email, ''), COALESCE(full_name, ''));
