# St. Francis Pilot — End-to-End Smoke Test Runbook

**Source plan:** `docs/superpowers/plans/2026-04-27-07-st-francis-pilot-smoke.md`
**Target environment:** production (`https://beat-snp.com`, Supabase project `omrfqisqsqgidcqellzy` / "beat-SNP")
**Driver:** organizer or engineer with admin access
**Duration:** ~90–120 minutes (expect to fast-forward DB clocks for finalization tasks)
**Pilot challenge identifiers (test):**
- Slug: `st-francis-hs-spy-2026-05-pilot`
- Test domain: `example.test` (override allowlist; restore before launch)
- Default charity: **St. Jude Children's Research Hospital** (EIN `35-1044585`)

> Re-runnable. Use `scripts/pilot-create-challenge.js` to recreate and `scripts/pilot-cleanup.js` to wipe between runs. Real launch creates a separate challenge with slug `st-francis-hs-spy-2026-05` (no `-pilot`).

---

## Tracking table

| #  | Task                                  | Status |
|----|---------------------------------------|--------|
| 0  | Pre-flight environment audit          | [ ]    |
| 0a | Test data setup (challenge created)   | [ ]    |
| 1  | Environment audit (env + cron + Twilio + Tremendous balance) | [ ] |
| 2  | Create pilot challenge as draft       | [ ]    |
| 3  | Add pilot organizer                   | [ ]    |
| 4  | Roster upload (optional)              | [ ]    |
| 5  | Flip to registration                  | [ ]    |
| 6  | Signup — under-18 path                | [ ]    |
| 7  | Signup — adult path                   | [ ]    |
| 8  | Signup — domain mismatch              | [ ]    |
| 9  | Universe enforcement                  | [ ]    |
| 10 | Mid-challenge rule change             | [ ]    |
| 11 | Removal flow                          | [ ]    |
| 12 | Fast-forward to end (finalize)        | [ ]    |
| 13 | Payout dashboard (Tremendous sandbox) | [ ]    |
| 14 | Webhook delivery                      | [ ]    |
| 15 | Manual fallback payout                | [ ]    |
| 16 | Consent revocation                    | [ ]    |
| 17 | Cleanup                               | [ ]    |
| 18 | Pilot launch readiness                | [ ]    |

Mark each row `[x]` (pass), `[~]` (pass-with-notes), or `[!]` (failure / blocker — see Go/no-go criteria).

---

## 0. Pre-flight environment audit

### 0.1 Verify Vercel env vars

Run the following from a terminal linked to the production Vercel project (`vercel link` if needed). **Do not paste secret values into this doc or any commit.**

```bash
# List all production env vars (names only)
vercel env ls production

# Confirm each of the following is present (look for the name in the output):
#   RESEND_API_KEY            (or the existing email provider — see §0.1a)
#   AGENTMAIL_API_KEY         (existing, confirmed)
#   TWILIO_ACCOUNT_SID        (optional for pilot — SMS path is no-op without it)
#   TWILIO_AUTH_TOKEN         (optional)
#   TWILIO_FROM_NUMBER        (optional)
#   TREMENDOUS_API_KEY        (optional — manual fallback works without)
#   TREMENDOUS_CAMPAIGN_ID    (optional)
#   TREMENDOUS_WEBHOOK_SECRET (optional)
#   CRON_SECRET               (REQUIRED — set; do not echo value)
#   SSGA_SPY_HOLDINGS_URL     (optional override)
#   PUBLIC_BASE_URL           (should equal https://beat-snp.com)
#   VITE_SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY (server-only)
```

### 0.1a Confirm email provider

The pilot uses AgentMail (existing). Verify:

```bash
vercel env ls production | grep -iE 'agentmail|resend'
```

If only AgentMail is present, that's fine — the pilot does not require Resend. Note this in your tracking sheet.

### 0.2 Verify SPY constituents exist for today

In Supabase SQL editor (project `omrfqisqsqgidcqellzy`):

```sql
SELECT count(*) AS rows, max(as_of_date) AS latest
FROM spy_constituents
WHERE as_of_date = current_date;
```

**Expected:** ~503 rows, `latest = current_date`. If 0 rows, the SPY ingestion cron has not yet run today; trigger manually:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" https://beat-snp.com/api/cron/spy-ingest
```

(Read `CRON_SECRET` locally from `vercel env pull` or the secure secrets store; never commit it.)

### 0.3 Verify cron schedules registered

```bash
# vercel.json should list these crons; confirm by inspecting the file or the dashboard:
#   /api/cron/spy-ingest               (daily)
#   /api/cron/challenge-lifecycle      (hourly or whatever cadence is configured)
#   /api/cron/competition-digest       (per digest cadence)
cat vercel.json | jq '.crons'
```

Then in the Vercel dashboard → Settings → Cron Jobs, confirm each is **Enabled**.

### 0.4 Verify required tables exist (post Plans 1–6)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'competitions',
    'competition_entries',
    'competition_organizers',
    'competition_audit_log',
    'competition_payouts',
    'competition_roster',
    'competition_notifications',
    'parental_consent_tokens',
    'parental_consents',
    'spy_constituents',
    'system_settings'
  )
ORDER BY table_name;
```

**Expected:** all 11 rows returned.

### 0.5 Verify migrations applied

```sql
SELECT version
FROM supabase_migrations.schema_migrations
WHERE version IN ('005','053','054','055','056','057','058','059','060')
ORDER BY version;
```

**Expected:** all 9 rows.

### 0.6 Twilio 10DLC (optional for pilot)

If running a school pilot without SMS, **skip**. Otherwise, log in to Twilio console → Messaging → Campaigns and confirm campaign status is `APPROVED`.

### 0.7 Tremendous balance (optional for pilot)

If using Tremendous live keys, log in → Dashboard → confirm balance ≥ $1,000. For sandbox testing in Tasks 13–14, ensure sandbox keys are available **but not yet swapped into prod** — we'll do that surgically at Task 13.

---

## 0a. Test data setup

### 0a.1 Choose creation method

**Option A (preferred, fast, scriptable):** run

```bash
cd /Users/martins-mini/Sites6/beat-SPY
SUPABASE_URL="https://omrfqisqsqgidcqellzy.supabase.co" \
SUPABASE_SERVICE_KEY="<service-role-key>" \
node scripts/pilot-create-challenge.js
```

This prints the new challenge ID and slug. Use these values throughout the runbook.

**Option B (admin UI):** follow Task 2 below.

### 0a.2 Reference values

| Field                                | Value                                            |
|--------------------------------------|--------------------------------------------------|
| name                                 | `St. Francis HS — Beat the S&P 500 (PILOT)`      |
| sponsor                              | `St. Francis HS`                                 |
| slug                                 | `st-francis-hs-spy-2026-05-pilot`                |
| benchmark_ticker                     | `SPY`                                            |
| starting_cash                        | `100000`                                         |
| registration_open                    | today (UTC midnight)                             |
| registration_close                   | start_date                                       |
| start_date                           | today + 7 days                                   |
| end_date                             | today + 37 days                                  |
| universe                             | `{"mode":"sp500_via_spy"}`                       |
| email_domain_allowlist               | `{example.test}` (pilot); `{stfrancishs.org}` (real launch) |
| prize_pool_amount                    | `1000`                                           |
| prize_pool_currency                  | `USD`                                            |
| prize_allocation                     | Hybrid 25/25/50 (see JSON below)                 |
| unfilled_bucket_policy               | `admin_decide`                                   |
| sms_enabled                          | `false`                                          |
| show_real_names                      | `true`                                           |
| convert_to_individual_on_complete    | `true`                                           |
| late_join_allowed                    | `false`                                          |
| digest_frequency                     | `weekly`                                         |
| status                               | `draft`                                          |
| default_charity (rules.default_charity) | `{"name":"St. Jude Children's Research Hospital","ein":"35-1044585"}` |

`prize_allocation` JSON (Hybrid 25/25/50):

```json
[
  {"bucket":"top_n","n":1,"share_pct":25},
  {"bucket":"top_n","n":2,"share_pct":25,"start_at":2},
  {"bucket":"beat_benchmark","share_pct":50}
]
```

### 0a.3 If using SQL directly

```sql
INSERT INTO competitions (
  name, sponsor, benchmark_ticker, starting_cash,
  registration_open, registration_close, start_date, end_date,
  status, slug, universe, email_domain_allowlist,
  prize_pool_amount, prize_pool_currency, prize_allocation,
  unfilled_bucket_policy, payout_provider, sms_enabled,
  show_real_names, convert_to_individual_on_complete,
  late_join_allowed, digest_frequency, rules, is_public, created_by
)
VALUES (
  'St. Francis HS — Beat the S&P 500 (PILOT)',
  'St. Francis HS',
  'SPY', 100000,
  now(), (now() + interval '7 days'),
  (now() + interval '7 days'), (now() + interval '37 days'),
  'draft', 'st-francis-hs-spy-2026-05-pilot',
  '{"mode":"sp500_via_spy"}'::jsonb,
  ARRAY['example.test'],
  1000, 'USD',
  '[{"bucket":"top_n","n":1,"share_pct":25},{"bucket":"top_n","n":2,"share_pct":25,"start_at":2},{"bucket":"beat_benchmark","share_pct":50}]'::jsonb,
  'admin_decide', 'tremendous', false,
  true, true, false, 'weekly',
  '{"default_charity":{"name":"St. Jude Children''s Research Hospital","ein":"35-1044585"}}'::jsonb,
  true,
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1)
)
RETURNING id, slug;
```

Record the returned `id` as `$PILOT_ID` for later steps.

---

## 1. Task 1 — Environment audit (formal sign-off)

- **Goal:** Lock in that §0.1–§0.7 are all green before continuing.
- **Steps:** Re-read each subsection. Tick off in tracking table.
- **Expected:** All required vars set; SPY ingest current; tables present; migrations 005, 053–060 applied.
- **Failure mode:** If any required env var is missing, set via `vercel env add`. If SPY ingest is empty, run §0.2 fallback `curl`. If a table is missing, **stop** — there's a migration drift; investigate before continuing.
- **Skip-when:** Never skip.

## 2. Task 2 — Create pilot challenge as draft

- **Goal:** Verify admin UI can create a challenge end-to-end with audit trail.
- **Steps:**
  1. Sign in to https://beat-snp.com as a global admin.
  2. Navigate to `/admin/competitions/new`.
  3. Fill in the values from §0a.2.
  4. Save as draft.
- **Expected:**
  - Redirect to `/admin/competitions/<id>` showing "Draft".
  - Audit log row exists: `SELECT * FROM competition_audit_log WHERE competition_id = '$PILOT_ID' ORDER BY created_at;` shows action `created` (or equivalent).
  - Slug visible at `/c/st-francis-hs-spy-2026-05-pilot` (404 expected for visitors until registration flips on).
- **Failure mode:** Form validation errors → screenshot, file ticket, fall back to SQL insert (§0a.3) and continue. Audit log empty → block until investigated (audit trigger may not be wired).
- **Skip-when:** Skip if you used `pilot-create-challenge.js` instead of the UI; just verify the audit row exists (the script triggers the same DB-level audit hook).

## 3. Task 3 — Add pilot organizer

- **Goal:** Confirm organizer-add flow + (optional) notification.
- **Steps:**
  1. On `/admin/competitions/<id>/organizers`, add the teacher's email (use a real teacher account or a test admin) with role `organizer`.
  2. Save.
- **Expected:**
  - Row in `competition_organizers` with role `organizer`.
  - Teacher receives "added as organizer" email (AgentMail) within 1 minute.
- **Failure mode:** No row → check RLS / form errors. No email → log as v2 ask (notification not in spec); not a blocker.
- **Skip-when:** Never skip. The DB row check is mandatory; the email check is best-effort.

## 4. Task 4 — Roster upload (optional)

- **Goal:** Verify CSV roster ingestion when teacher pre-loads students.
- **Steps:**
  1. Build CSV with 5 rows:
     ```
     email,full_name
     student-1@example.test,Test Student One
     student-2@example.test,Test Student Two
     student-3@example.test,Test Student Three
     student-4@example.test,Test Student Four
     student-5@example.test,Test Student Five
     ```
  2. Confirm `email_domain_allowlist` includes `example.test` (it does per §0a.2).
  3. On `/admin/competitions/<id>/roster`, upload CSV.
- **Expected:** 5 rows in `competition_roster` with `status='invited'`.
- **Failure mode:** If parser rejects, check CSV encoding (UTF-8, no BOM) and column names match.
- **Skip-when:** Skip if you intentionally want to test the open-signup path only. Document that decision in tracking notes.

## 5. Task 5 — Flip to registration

- **Goal:** Public landing page renders.
- **Steps:**
  1. On `/admin/competitions/<id>`, change status to `registration`. Save.
  2. Open an incognito window and visit `https://beat-snp.com/c/st-francis-hs-spy-2026-05-pilot`.
- **Expected:** Public page shows challenge name, dates, rules summary, prize pool, empty leaderboard, Join button.
- **Failure mode:** 404 → check slug exact match. 500 → check function logs (`vercel logs`).
- **Skip-when:** Never.

## 6. Task 6 — Signup, under-18 path

- **Goal:** End-to-end COPPA/parental-consent flow.
- **Steps:**
  1. From the landing page, click **Join**.
  2. Sign up with:
     - Email: `student-1@example.test`
     - Real name: `Test Student One`
     - DOB: today minus 16 years
     - Parent email: `parent-1@example.test` (route this domain to Mailtrap or your catchall — see Note A)
     - Parent language: `ES`
     - Password: a strong password (record it for re-login)
  3. Submit.
  4. Open the parent inbox; click the consent link.
  5. Verify Spanish renders. Click language toggle → English. Toggle back to Spanish.
  6. Submit consent: parent name `Padre Uno`, relationship `Padre/Madre`, check all three boxes including SMS.
  7. Re-login as `student-1@example.test`.
- **Expected:**
  - After signup, profile row shows `account_state='pending_parental_consent'`.
  - `parental_consent_tokens` row created.
  - Parent email arrives in Spanish.
  - After consent: profile flips to `consented`; `parental_consents` row exists; `competition_entries` row auto-created with `status='active'`.
  - On re-login, student lands on the challenge portfolio page.
- **Failure mode:**
  - No parent email → check AgentMail logs; **blocker**.
  - Spanish text missing/garbled → blocker (Spanish-speaking parents are a core pilot constraint).
  - Account doesn't flip to `consented` → check the consent submission endpoint logs; blocker.
- **Skip-when:** Never — this is the highest-risk path.

> **Note A:** Set up `example.test` to route to Mailtrap or your dev catchall before this step. If you can't, use a real domain you control (e.g., `+pilot1@yourname.com`) but update the SQL/admin allowlist accordingly.

## 7. Task 7 — Signup, adult path

- **Goal:** Verify no-consent fast path.
- **Steps:**
  1. Sign up `student-2@example.test`, DOB today minus 25 years, no parent fields.
- **Expected:** Account state `active`, no consent tokens row, auto-registered into challenge.
- **Failure mode:** If parent fields render → DOB-based gating broken. Blocker.
- **Skip-when:** Never.

## 8. Task 8 — Signup, domain mismatch

- **Goal:** Verify allowlist rejects outsiders.
- **Steps:**
  1. Temporarily change `email_domain_allowlist` to `{stfrancishs.org}` (real domain).

     ```sql
     UPDATE competitions
     SET email_domain_allowlist = ARRAY['stfrancishs.org']
     WHERE slug = 'st-francis-hs-spy-2026-05-pilot';
     ```
  2. From an incognito window, attempt signup with `attacker@gmail.com`.
- **Expected:** Friendly error: "This challenge is restricted to students from your school's email domain" (or copy-equivalent), error code `domain_not_allowed`.
- **Failure mode:** Signup succeeds → blocker. Restore allowlist before continuing:

  ```sql
  UPDATE competitions
  SET email_domain_allowlist = ARRAY['example.test']
  WHERE slug = 'st-francis-hs-spy-2026-05-pilot';
  ```

- **Skip-when:** Never.

## 9. Task 9 — Universe enforcement

- **Goal:** Trades restricted to S&P 500 constituents during active phase.
- **Steps:**
  1. Fast-forward DB:
     ```sql
     UPDATE competitions
     SET start_date = now() - interval '1 hour',
         status = 'active',
         universe = jsonb_set(universe, '{snapshot_date}', to_jsonb(current_date::text))
     WHERE slug = 'st-francis-hs-spy-2026-05-pilot';
     ```
  2. As `student-2@example.test`, attempt to buy `BTC-USD`.
  3. Then attempt to buy `AAPL`.
- **Expected:** First trade returns 422 with friendly message (e.g., "Ticker not in this challenge's universe"). Second trade succeeds.
- **Failure mode:** BTC trade succeeds → universe enforcement broken. Blocker.
- **Skip-when:** Never.

## 10. Task 10 — Mid-challenge rule change notification

- **Goal:** Rule-change notifications fire to all entrants.
- **Steps:**
  1. As organizer, on `/admin/competitions/<id>`, change `prize_pool_amount` from 1000 to 1500. Save.
  2. Confirm dialog appears warning notifications will be sent. Confirm.
- **Expected:**
  - `competition_audit_log` row written for the change.
  - `competition_notifications` rows created (kind=`rule_change` per spec) for each active entrant.
  - Email arrives at `student-1` and `student-2` test inboxes.
- **Failure mode:** No notifications → check the rule-change trigger / handler; blocker if launching with rule-change capability advertised.
- **Skip-when:** Skip if pilot is locked-spec only. Note in tracker.

## 11. Task 11 — Removal flow

- **Goal:** Organizer can remove a participant; downstream effects propagate.
- **Steps:**
  1. As organizer, remove `student-2@example.test` with reason "internal test cleanup".
- **Expected:**
  - `competition_entries.status = 'removed'`, `removed_reason = 'internal test cleanup'`.
  - "Removed from challenge" notification (kind=`removed`) sent.
  - Leaderboard no longer shows student-2.
  - Student-2's portfolio still exists (`portfolios` row intact).
- **Failure mode:** Portfolio deleted → data-loss bug; blocker. Notification missing → log; not a launch blocker if SMS-only.
- **Skip-when:** Never.

## 12. Task 12 — Fast-forward to end (finalize)

- **Goal:** Lifecycle cron computes final ranks, beat-benchmark, payouts.
- **Steps:**
  1. ```sql
     UPDATE competitions
     SET end_date = now() - interval '1 minute'
     WHERE slug = 'st-francis-hs-spy-2026-05-pilot';
     ```
  2. Trigger lifecycle:
     ```bash
     curl -i -H "Authorization: Bearer $CRON_SECRET" \
       https://beat-snp.com/api/cron/challenge-lifecycle
     ```
- **Expected:**
  - Active entries (e.g., student-1) have `final_rank`, `final_return_pct`, `beat_benchmark`, `excess_return_pct` populated.
  - `competition_payouts` rows in status `pending`.
  - Competition `status` is `finalized` or `pending_organizer_decision` (depending on unfilled-bucket policy = `admin_decide` → expect `pending_organizer_decision`).
  - For active entries, `portfolios.owner_type` flipped from challenge-scoped to `'user'` (per `convert_to_individual_on_complete=true`).
- **Failure mode:**
  - Rank columns null → finalize routine didn't run. Re-trigger; check logs.
  - Status not advanced → check unfilled-bucket branch logic; blocker.
- **Skip-when:** Never.

## 13. Task 13 — Payout dashboard (Tremendous sandbox)

- **Goal:** Send-all flow against Tremendous sandbox.
- **Pre-step:** Add Tremendous sandbox keys to a separate Vercel preview deployment (not prod) and run this task against the preview, OR temporarily flip the prod env vars (record original prod values first):

  ```bash
  # Capture current prod values to restore later.
  vercel env pull .env.prod-backup --environment=production

  # Then in dashboard, set TREMENDOUS_API_KEY / TREMENDOUS_CAMPAIGN_ID / TREMENDOUS_WEBHOOK_SECRET
  # to sandbox values, redeploy, run the test, then restore.
  ```

- **Steps:**
  1. As organizer, open `/admin/competitions/<id>/payouts`.
  2. Confirm pending payouts visible; balance check passes.
  3. Click **Send all**.
- **Expected:**
  - Each payout row flips to `status='sent'`, `provider_payout_id` populated.
  - `won_payout` notifications fire for each winner.
- **Failure mode:**
  - Balance check fails → fund sandbox account.
  - 500 from Tremendous → check API key scope.
- **Skip-when:** **Skip entirely if Tremendous is not configured** (per state-of-world). In that case, jump to Task 15 (manual fallback) for the only payable winner. Document skip in tracking.

## 14. Task 14 — Webhook delivery

- **Goal:** `REWARDS.DELIVERED` webhook moves payout to `delivered`.
- **Steps:**
  1. In Tremendous sandbox, simulate `REWARDS.DELIVERED` for one of the sent rewards (or claim the reward end-to-end as the recipient).
- **Expected:** Corresponding `competition_payouts` row → `status='delivered'`, `paid_at` set.
- **Failure mode:** Webhook signature verification fails → check `TREMENDOUS_WEBHOOK_SECRET`. Blocker if Tremendous is in scope.
- **Skip-when:** Skip if Task 13 was skipped.

## 15. Task 15 — Manual fallback payout

- **Goal:** Out-of-band payments can be recorded.
- **Steps:**
  1. Pick a remaining `pending` payout row.
  2. Click **Mark manual**, enter note `Paid via Venmo, ref XYZ`.
- **Expected:** Status `paid_manually`, `manual_note` saved, audit log row, `won_payout` notification fired.
- **Failure mode:** Status doesn't update → blocker (this is the safety net for the no-Tremendous case).
- **Skip-when:** Never. **This is required** because Tremendous is not yet configured.

## 16. Task 16 — Consent revocation

- **Goal:** Parents can revoke; downstream effects propagate.
- **Steps:**
  1. In the parent inbox for `parent-1@example.test`, find the original consent email and click the **Revoke consent** link.
  2. Confirm revocation.
- **Expected:**
  - `parental_consents.status = 'revoked'` (or equivalent).
  - Student `account_state = 'revoked'`.
  - Any active competition entries flipped to `removed`.
  - Pending payouts for the student held (status remains `pending`, with hold flag — verify in `competition_payouts`).
- **Failure mode:** Payouts disbursed despite revocation → **critical blocker**.
- **Skip-when:** Skip only if the Task 6 under-18 path was skipped (no consent to revoke).

## 17. Task 17 — Cleanup (smoke test)

- **Goal:** Leave the DB clean before real launch.
- **Steps:**
  1. Run helper: `node scripts/pilot-cleanup.js` (will prompt for confirmation).
  2. Confirm `competitions` and related rows for slug `st-francis-hs-spy-2026-05-pilot` are gone, plus all `@example.test` users.
  3. Restore any prod env vars you swapped for Task 13.
- **Expected:** Verification queries (printed by the cleanup script) all return 0.
- **Failure mode:** Foreign-key constraints → run the SQL block in §Cleanup section below in the listed order.
- **Skip-when:** Never.

## 18. Task 18 — Pilot launch readiness

Final go/no-go checklist before the **real** challenge:

- [ ] Tasks 1–17 all `[x]` or `[~]` with documented justification.
- [ ] Teacher trained on organizer dashboard (15-minute walkthrough recorded or live).
- [ ] Spanish consent text reviewed by a fluent speaker (link signoff in tracker).
- [ ] School announcement to parents drafted and approved.
- [ ] Tremendous funded for real prize pool **OR** explicit decision to use manual payouts only (document in tracker).
- [ ] Real challenge created with slug `st-francis-hs-spy-2026-05` and `email_domain_allowlist = {stfrancishs.org}`.
- [ ] Real challenge status flipped to `registration`.
- [ ] Share link distributed by teacher via school's regular channel.

---

## Cleanup section (manual SQL fallback)

If the cleanup script can't run, execute in this order. Replace `:slug` with `'st-francis-hs-spy-2026-05-pilot'`. Wrap in a transaction.

```sql
BEGIN;

-- 1. Capture target IDs for reuse
WITH comp AS (
  SELECT id FROM competitions WHERE slug = 'st-francis-hs-spy-2026-05-pilot'
),
test_users AS (
  SELECT id FROM profiles WHERE email LIKE '%@example.test'
)
SELECT
  (SELECT id FROM comp) AS comp_id,
  (SELECT count(*) FROM test_users) AS test_user_count;

-- 2. Delete child rows for the competition
DELETE FROM competition_payouts          WHERE competition_id IN (SELECT id FROM competitions WHERE slug = 'st-francis-hs-spy-2026-05-pilot');
DELETE FROM competition_notifications    WHERE competition_id IN (SELECT id FROM competitions WHERE slug = 'st-francis-hs-spy-2026-05-pilot');
DELETE FROM competition_audit_log        WHERE competition_id IN (SELECT id FROM competitions WHERE slug = 'st-francis-hs-spy-2026-05-pilot');
DELETE FROM competition_roster           WHERE competition_id IN (SELECT id FROM competitions WHERE slug = 'st-francis-hs-spy-2026-05-pilot');
DELETE FROM competition_organizers       WHERE competition_id IN (SELECT id FROM competitions WHERE slug = 'st-francis-hs-spy-2026-05-pilot');
DELETE FROM competition_entries          WHERE competition_id IN (SELECT id FROM competitions WHERE slug = 'st-francis-hs-spy-2026-05-pilot');

-- 3. Delete the competition itself
DELETE FROM competitions WHERE slug = 'st-francis-hs-spy-2026-05-pilot';

-- 4. Delete consent + portfolios + auth users for @example.test profiles
DELETE FROM parental_consent_tokens WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@example.test');
DELETE FROM parental_consents       WHERE user_id IN (SELECT id FROM profiles WHERE email LIKE '%@example.test');
DELETE FROM portfolios              WHERE owner_user_id IN (SELECT id FROM profiles WHERE email LIKE '%@example.test');
DELETE FROM profiles                WHERE email LIKE '%@example.test';

-- 5. (Service-role only) Delete the auth.users rows. Run via SQL editor as service role:
DELETE FROM auth.users WHERE email LIKE '%@example.test';

COMMIT;
```

> If the `parent-N@example.test` accounts were created as full auth users (not just consent recipients), they're cleaned up by the same `LIKE '%@example.test'` filter.

---

## Go/no-go decision criteria

### Blockers (must be fixed before announcing pilot)

- Task 1: any required env var missing (CRON_SECRET, PUBLIC_BASE_URL, AgentMail key, SUPABASE_SERVICE_ROLE_KEY).
- Task 1: SPY constituents empty for today.
- Task 1: any of migrations 005, 053–060 missing.
- Task 5: public landing page returns 5xx.
- Task 6: parent email never arrives (AgentMail broken) — **hard blocker, schools cannot use this.**
- Task 6: Spanish consent text missing or visibly garbled.
- Task 6: account fails to flip to `consented` after submission.
- Task 7: parent fields render on a 25-year-old's signup (DOB gating broken).
- Task 8: outsider can join with non-allowlisted domain.
- Task 9: non-S&P ticker (e.g., BTC-USD) trade succeeds during active phase.
- Task 11: removing a student deletes their portfolio (data loss).
- Task 12: finalize doesn't compute ranks or doesn't generate payout rows.
- Task 15: manual-fallback payout cannot be recorded — **blocker because Tremendous is not configured.**
- Task 16: revoked consent does not hold pending payouts.

### Acceptable (document, don't block)

- Task 1: TWILIO_* unset → SMS path is no-op by design (pilot is email-only with `sms_enabled=false`).
- Task 1: TREMENDOUS_* unset → falls back to manual payouts (verified in Task 15).
- Task 3: organizer-added email not received → out of spec; log as v2 ask.
- Task 4: skipped (organizer chose open signup).
- Task 10: rule-change notification copy could be tuned → log polish ticket.
- Task 13/14: skipped because Tremendous not configured.

### Tremendous-funded launch (future)

If/when Tremendous is configured before launch, re-run Tasks 13 and 14 against sandbox. Tremendous sandbox passing is required to flip live keys. Tremendous live keys must be balance-checked before flipping the real challenge to `registration`.

---

## Helper scripts

- `scripts/pilot-create-challenge.js` — create the pilot challenge via service role.
- `scripts/pilot-cleanup.js` — wipe all `@example.test` test data and the pilot challenge.

Both refuse to run unless `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set in the environment.

```bash
# Typical workflow:
export SUPABASE_URL="https://omrfqisqsqgidcqellzy.supabase.co"
export SUPABASE_SERVICE_KEY="<from 1password / vercel env pull>"

node scripts/pilot-create-challenge.js   # creates the pilot
# ... run smoke test ...
node scripts/pilot-cleanup.js            # wipes it (asks "yes" before destructive ops)
```
