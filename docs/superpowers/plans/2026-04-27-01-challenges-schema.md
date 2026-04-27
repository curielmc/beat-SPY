# Plan 1 — Challenges Schema & Migrations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Land all schema changes for the challenges module in one batch so subsequent plans (universe, signup/consent, prizes, notifications, payouts) have stable storage to build against.

**Architecture:** A single migration `053_challenges_robust.sql` plus one followup `054_drop_legacy_prizes.sql` (separated so the column drop is reviewable on its own). All RLS policies declared inline. No business logic — pure schema.

**Tech stack:** Supabase Postgres (raw SQL migrations), no app code in this plan.

**Spec sections covered:** §3 (data model), §11 schema columns, §12 schema columns.

---

### Task 1: Add `competitions` columns

**Files:**
- Create: `supabase/migrations/053_challenges_robust.sql` (start of file)

- [ ] **Step 1:** Create migration file with header

```sql
-- Migration 053: Challenges module — robust version
-- Adds: slug/share token, universe, gating, prize pool + allocation, organizer/audit/payout/roster/consent/SMS infra
-- Spec: docs/superpowers/specs/2026-04-27-challenges-module-design.md
```

- [ ] **Step 2:** Add new columns to `competitions`

```sql
ALTER TABLE competitions
  ADD COLUMN slug                              text UNIQUE,
  ADD COLUMN share_token                       text UNIQUE,
  ADD COLUMN universe                          jsonb NOT NULL DEFAULT '{"mode":"app_all"}'::jsonb,
  ADD COLUMN email_domain_allowlist            text[],
  ADD COLUMN prize_pool_amount                 numeric,
  ADD COLUMN prize_pool_currency               text NOT NULL DEFAULT 'USD',
  ADD COLUMN prize_allocation                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN unfilled_bucket_policy            text NOT NULL DEFAULT 'admin_decide'
      CHECK (unfilled_bucket_policy IN ('roll_forward','return_to_sponsor','admin_decide')),
  ADD COLUMN payout_provider                   text NOT NULL DEFAULT 'tremendous',
  ADD COLUMN convert_to_individual_on_complete boolean NOT NULL DEFAULT true,
  ADD COLUMN show_real_names                   boolean NOT NULL DEFAULT true,
  ADD COLUMN sms_enabled                       boolean NOT NULL DEFAULT true,
  ADD COLUMN late_join_allowed                 boolean NOT NULL DEFAULT false,
  ADD COLUMN digest_frequency                  text NOT NULL DEFAULT 'weekly'
      CHECK (digest_frequency IN ('off','daily','weekly')),
  ADD COLUMN spy_return_pct                    numeric,
  ADD COLUMN finalized_at                      timestamptz;

-- Allow new status values used at finalization time
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_status_check;
ALTER TABLE competitions ADD CONSTRAINT competitions_status_check
  CHECK (status IN ('draft','registration','active','completed','cancelled','pending_organizer_decision','finalized'));

CREATE INDEX IF NOT EXISTS idx_competitions_slug ON competitions(slug);
```

- [ ] **Step 3:** Backfill `slug` for existing competitions (idempotent)

```sql
UPDATE competitions
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;
```

### Task 2: Add `competition_entries` columns

- [ ] **Step 1:** Append to migration file

```sql
ALTER TABLE competition_entries
  ADD COLUMN status              text NOT NULL DEFAULT 'active'
      CHECK (status IN ('active','removed','dq')),
  ADD COLUMN removed_reason      text,
  ADD COLUMN beat_benchmark      boolean,
  ADD COLUMN excess_return_pct   numeric;

CREATE INDEX IF NOT EXISTS idx_competition_entries_status ON competition_entries(status);
```

### Task 3: New table `competition_organizers`

- [ ] **Step 1:** Append

```sql
CREATE TABLE competition_organizers (
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  user_id        uuid REFERENCES profiles(id)     ON DELETE CASCADE NOT NULL,
  role           text NOT NULL CHECK (role IN ('owner','organizer','viewer')),
  created_at     timestamptz DEFAULT now(),
  PRIMARY KEY (competition_id, user_id)
);

CREATE INDEX idx_competition_organizers_user ON competition_organizers(user_id);

ALTER TABLE competition_organizers ENABLE ROW LEVEL SECURITY;

-- Anyone in the table can read it (so detail pages can show "Organized by")
CREATE POLICY "organizer rows readable" ON competition_organizers FOR SELECT USING (true);

-- Only admins or existing owners can mutate
CREATE POLICY "organizer rows mutable by owners/admins" ON competition_organizers
  FOR ALL USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM competition_organizers o2
      WHERE o2.competition_id = competition_organizers.competition_id
        AND o2.user_id = auth.uid()
        AND o2.role = 'owner'
    )
  );

-- Backfill: every existing competition's `created_by` becomes its owner
INSERT INTO competition_organizers (competition_id, user_id, role)
SELECT id, created_by, 'owner' FROM competitions
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2:** Update existing competitions RLS so organizers (not just admins) can mutate

```sql
DROP POLICY IF EXISTS "Admins can manage competitions" ON competitions;

CREATE POLICY "Admins or organizers can manage competitions" ON competitions
  FOR ALL USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM competition_organizers o
      WHERE o.competition_id = competitions.id
        AND o.user_id = auth.uid()
        AND o.role IN ('owner','organizer')
    )
  );
```

### Task 4: New table `competition_roster`

- [ ] **Step 1:** Append

```sql
CREATE TABLE competition_roster (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id   uuid REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  email            text NOT NULL,
  full_name        text,
  status           text NOT NULL DEFAULT 'invited'
      CHECK (status IN ('invited','registered','rejected')),
  matched_user_id  uuid REFERENCES profiles(id),
  invited_at       timestamptz DEFAULT now(),
  registered_at    timestamptz,
  UNIQUE (competition_id, lower(email))
);

CREATE INDEX idx_competition_roster_email ON competition_roster(lower(email));
ALTER TABLE competition_roster ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roster readable by organizers/admins" ON competition_roster
  FOR SELECT USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM competition_organizers o
      WHERE o.competition_id = competition_roster.competition_id
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "roster mutable by organizers/admins" ON competition_roster
  FOR ALL USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM competition_organizers o
      WHERE o.competition_id = competition_roster.competition_id
        AND o.user_id = auth.uid()
        AND o.role IN ('owner','organizer')
    )
  );
```

### Task 5: New table `competition_audit_log`

- [ ] **Step 1:** Append

```sql
CREATE TABLE competition_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id  uuid REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  actor_id        uuid REFERENCES profiles(id),
  action          text NOT NULL,
  before          jsonb,
  after           jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_log_competition ON competition_audit_log(competition_id, created_at DESC);
ALTER TABLE competition_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit readable by organizers/admins" ON competition_audit_log
  FOR SELECT USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM competition_organizers o
      WHERE o.competition_id = competition_audit_log.competition_id
        AND o.user_id = auth.uid()
    )
  );

-- Inserts only via service role / API; no public insert policy.
```

### Task 6: New table `competition_payouts`

- [ ] **Step 1:** Append

```sql
CREATE TABLE competition_payouts (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id              uuid REFERENCES competitions(id) ON DELETE CASCADE NOT NULL,
  user_id                     uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  amount                      numeric NOT NULL,
  currency                    text NOT NULL DEFAULT 'USD',
  provider                    text NOT NULL DEFAULT 'tremendous',
  provider_payout_id          text,
  status                      text NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','sent','delivered','failed','canceled','paid_manually')),
  manual_note                 text,
  claimed_at                  timestamptz,
  paid_at                     timestamptz,
  error                       text,
  created_at                  timestamptz DEFAULT now()
);

CREATE INDEX idx_payouts_competition ON competition_payouts(competition_id);
CREATE INDEX idx_payouts_status ON competition_payouts(status);
ALTER TABLE competition_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts readable by recipient/organizer/admin" ON competition_payouts
  FOR SELECT USING (
    user_id = auth.uid() OR is_admin() OR
    EXISTS (
      SELECT 1 FROM competition_organizers o
      WHERE o.competition_id = competition_payouts.competition_id
        AND o.user_id = auth.uid()
    )
  );

-- Mutations only via service role
```

### Task 7: New table `spy_constituents`

- [ ] **Step 1:** Append

```sql
CREATE TABLE spy_constituents (
  ticker      text NOT NULL,
  weight      numeric,
  as_of_date  date NOT NULL,
  PRIMARY KEY (ticker, as_of_date)
);

CREATE INDEX idx_spy_constituents_date ON spy_constituents(as_of_date DESC);
ALTER TABLE spy_constituents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spy constituents readable" ON spy_constituents FOR SELECT USING (true);
-- Inserts via service role only
```

### Task 8: New tables `parental_consents` and `parent_subscriptions`

- [ ] **Step 1:** Append

```sql
CREATE TABLE parental_consents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_name           text NOT NULL,
  parent_email          text NOT NULL,
  parent_phone_e164     text,
  relationship          text NOT NULL,
  consented_at          timestamptz NOT NULL DEFAULT now(),
  ip                    inet,
  user_agent            text,
  consent_text_version  text NOT NULL,
  consent_locale        text NOT NULL CHECK (consent_locale IN ('en','es')),
  signature_text        text NOT NULL,
  revoked_at            timestamptz,
  revoked_reason        text
);

CREATE INDEX idx_parental_consents_user ON parental_consents(user_id, consented_at DESC);
ALTER TABLE parental_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consents readable by owner/admin" ON parental_consents
  FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE TABLE parent_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_email          text NOT NULL,
  user_id               uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  notify_email          boolean NOT NULL DEFAULT true,
  notify_sms            boolean NOT NULL DEFAULT false,
  parent_phone_e164     text,
  language              text NOT NULL DEFAULT 'en' CHECK (language IN ('en','es')),
  created_at            timestamptz DEFAULT now(),
  UNIQUE (user_id, parent_email)
);
ALTER TABLE parent_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parent subs readable by student/admin" ON parent_subscriptions
  FOR SELECT USING (user_id = auth.uid() OR is_admin());
```

### Task 9: `profiles` columns for DOB / consent / SMS

- [ ] **Step 1:** Append

```sql
ALTER TABLE profiles
  ADD COLUMN date_of_birth                date,
  ADD COLUMN parent_email                 text,
  ADD COLUMN parent_language              text NOT NULL DEFAULT 'en'
      CHECK (parent_language IN ('en','es')),
  ADD COLUMN parental_consent_status      text NOT NULL DEFAULT 'not_required'
      CHECK (parental_consent_status IN ('not_required','pending','consented','revoked','expired')),
  ADD COLUMN parental_consent_at          timestamptz,
  ADD COLUMN parental_consent_expires_at  timestamptz,
  ADD COLUMN phone_e164                   text,
  ADD COLUMN sms_opt_in                   boolean NOT NULL DEFAULT false,
  ADD COLUMN sms_opt_in_at                timestamptz;

CREATE INDEX idx_profiles_consent_status ON profiles(parental_consent_status);
CREATE INDEX idx_profiles_consent_expires ON profiles(parental_consent_expires_at)
  WHERE parental_consent_status = 'consented';
```

### Task 10: Migrate legacy `prizes` jsonb into `prize_allocation`

- [ ] **Step 1:** Append data migration

```sql
-- Convert legacy { place, description } prizes into a single top_n bucket where amount is null
-- (description text preserved into prize_allocation[0].notes)
UPDATE competitions c
SET prize_allocation = jsonb_build_array(jsonb_build_object(
  'eligibility', 'top_n',
  'n', jsonb_array_length(c.prizes),
  'allocation', jsonb_build_object('type','percent_of_pool','value', 100),
  'split', 'weighted_by_rank',
  'legacy_prizes', c.prizes
))
WHERE jsonb_typeof(c.prizes) = 'array' AND jsonb_array_length(c.prizes) > 0
  AND c.prize_allocation = '[]'::jsonb;
```

- [ ] **Step 2:** Verify visually before separate followup migration drops the legacy column

### Task 11: Run migrations & smoke test

- [ ] **Step 1:** Push migration via Supabase

```bash
npx supabase db push
```

Expected: migration applies cleanly. If error, fix syntax and re-run.

- [ ] **Step 2:** Smoke-test SQL

```bash
psql "$SUPABASE_DB_URL" -c "
  SELECT slug, universe, prize_allocation FROM competitions LIMIT 5;
  SELECT count(*) FROM competition_organizers;
  SELECT column_name FROM information_schema.columns
  WHERE table_name='profiles' AND column_name LIKE 'parent%';
"
```

Expected: every existing competition has a slug; one organizer row per pre-existing competition; `parent_email`, `parent_language`, `parental_consent_status`, etc. all listed.

- [ ] **Step 3:** Commit

```bash
git add supabase/migrations/053_challenges_robust.sql
git commit -m "feat(challenges): schema for robust challenges module

053 lands schema for: slug/share token, universe, email-domain
allowlist, prize pool + allocation buckets, organizer role + audit log,
roster, payouts, SPY constituents cache, parental consent + parent
subscriptions, profile DOB/SMS/consent fields. Backfills slug and
seeds owner organizer rows from competitions.created_by."
```

### Task 12: Followup migration to drop legacy `prizes` column

**Files:**
- Create: `supabase/migrations/054_drop_legacy_prizes.sql`

- [ ] **Step 1:** Confirm `prize_allocation` populated for every row that had legacy prizes

```bash
psql "$SUPABASE_DB_URL" -c "
  SELECT count(*) FROM competitions
  WHERE jsonb_array_length(prizes) > 0 AND prize_allocation = '[]'::jsonb;
"
```

Expected: `0`. If non-zero, fix the data first; do not run this migration.

- [ ] **Step 2:** Write migration

```sql
-- Migration 054: drop legacy `prizes` column on competitions
-- Data was migrated to prize_allocation in 053.
ALTER TABLE competitions DROP COLUMN prizes;
```

- [ ] **Step 3:** Push and verify

```bash
npx supabase db push
psql "$SUPABASE_DB_URL" -c "\d competitions" | grep prizes
```

Expected: no `prizes` column listed.

- [ ] **Step 4:** Commit

```bash
git add supabase/migrations/054_drop_legacy_prizes.sql
git commit -m "feat(challenges): drop legacy prizes column (migrated in 053)"
```

---

## Self-review checklist (perform before handing off)

- [ ] Every spec §3 column accounted for in a migration step
- [ ] Every new table has RLS enabled and at least a SELECT policy
- [ ] No CHECK constraint references a value not listed in the spec
- [ ] Slug backfill handled (no NULL slugs after migration)
- [ ] Owner backfill handled (every existing competition has a row in `competition_organizers`)
- [ ] Status check includes new finalization states
