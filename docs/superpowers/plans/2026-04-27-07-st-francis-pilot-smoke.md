# Plan 7 — St. Francis Pilot Smoke Test (End-to-End Dry Run)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (this is a checklist, not a code-writing plan).

**Goal:** Before announcing the pilot to St. Francis students, run a full end-to-end dry-run with internal test users to catch any integration gaps that unit tests don't surface.

**Architecture:** Verification-only plan. Reads spec §17 staging-gate sequencing. Uses test users at a dummy domain (`example.test`) and the Tremendous sandbox.

**Tech stack:** No new code; ops + verification.

---

### Task 1: Environment audit

- [ ] Confirm prod env has these vars set: `RESEND_API_KEY` (or existing email), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TREMENDOUS_API_KEY`, `TREMENDOUS_CAMPAIGN_ID`, `TREMENDOUS_WEBHOOK_SECRET`, `CRON_SECRET`, `SSGA_SPY_HOLDINGS_URL` (optional override), `PUBLIC_BASE_URL`
- [ ] Confirm SPY constituents cron has run at least once (`select count(*) from spy_constituents where as_of_date = current_date`)
- [ ] Confirm 10DLC campaign approved in Twilio
- [ ] Confirm Tremendous balance ≥ planned prize pool

### Task 2: Create the pilot challenge as draft

- [ ] Sign in as global admin
- [ ] Create challenge via admin UI:
  - Name: "St. Francis HS — Beat the S&P 500"
  - Sponsor: (leave blank or "St. Francis HS")
  - Slug: `st-francis-hs-spy-2026-05`
  - Benchmark ticker: `SPY`
  - Starting cash: `100000`
  - Start date: 7 days from now
  - End date: 37 days from now (30-day window)
  - Registration opens: today
  - Registration closes: start date
  - Universe mode: `sp500_via_spy`
  - Email-domain allowlist: `stfrancishs.org` (replace with actual school domain)
  - Prize pool: $1,000
  - Prize allocation preset: Hybrid 25/25/50 (or per organizer's preference)
  - Unfilled-bucket policy: Ask me at finalization
  - SMS enabled: false (pilot — keep email-only for school context per Plan 5 discussion)
  - Show real names: true
  - Convert to individual on complete: true
- [ ] Save as `draft`. Verify created. Verify audit log row exists.

### Task 3: Add pilot organizer

- [ ] In Organizers panel, add the teacher's email as `organizer`
- [ ] Verify teacher receives an "added as organizer" email (notification not in spec — log this as a v2 ask if missing)

### Task 4: Roster upload (optional)

- [ ] Prepare CSV with 5 internal test users at `example.test` domain
- [ ] Override domain allowlist temporarily to include `example.test`
- [ ] Upload CSV via admin UI; verify roster rows appear with `status='invited'`

### Task 5: Flip to registration

- [ ] Status → `registration`
- [ ] Visit `/c/st-francis-hs-spy-2026-05` while logged out → page renders publicly with name, dates, rules, prizes; leaderboard empty.

### Task 6: Test signup flow — under-18 path

- [ ] Click Join. Sign up:
  - Email: `student-1@example.test`
  - Real name: "Test Student One"
  - DOB: 16 years ago
  - Parent email: `parent-1@example.test` (use mailtrap or similar to receive)
  - Parent language: ES
  - Password: secure
- [ ] Verify account created in `pending_parental_consent` state
- [ ] Verify parent received email in Spanish with consent link
- [ ] Open consent link, verify Spanish renders correctly, toggle to English, toggle back
- [ ] Submit consent with parent name "Padre Uno", relationship "Padre/Madre", check all three checkboxes including SMS
- [ ] Verify student account flips to `consented`
- [ ] Verify auto-registration completed; redirected to challenge portfolio

### Task 7: Test signup flow — adult path

- [ ] Sign up `student-2@example.test`, DOB 25 years ago, no parent fields shown
- [ ] Verify auto-registration completed without consent flow

### Task 8: Test signup flow — domain mismatch

- [ ] Restore real `stfrancishs.org` allowlist
- [ ] Try signup with `attacker@gmail.com` and click Join
- [ ] Expect `domain_not_allowed` error message

### Task 9: Test universe enforcement

- [ ] As student-2 (registered), wait until challenge `start_date` passes (or manually update DB to flip status to `active` and set `universe.snapshot_date` to today)
- [ ] Try to buy `BTC-USD` (or a non-S&P ticker) → expect 422 with friendly error
- [ ] Try to buy `AAPL` → expect success

### Task 10: Test mid-challenge rule change

- [ ] As organizer, update `prize_pool_amount` from 1000 → 1500
- [ ] Verify confirmation dialog fires
- [ ] Verify all current entrants receive rule-change notification (#8)
- [ ] Verify audit log row written

### Task 11: Test removal flow

- [ ] As organizer, remove `student-2` with reason "internal test cleanup"
- [ ] Verify entry status flipped to `removed`
- [ ] Verify removed-from-challenge notification (#9) sent
- [ ] Verify student-2's portfolio still exists but is no longer on leaderboard

### Task 12: Fast-forward to end

- [ ] Manually update DB: `UPDATE competitions SET end_date = now() WHERE slug = 'st-francis-hs-spy-2026-05'`
- [ ] Wait for next lifecycle cron (or trigger manually with `curl -H "Authorization: Bearer $CRON_SECRET" /api/cron/challenge-lifecycle`)
- [ ] Verify finalize completed:
  - `final_rank`, `final_return_pct`, `beat_benchmark`, `excess_return_pct` populated for active entries
  - `competition_payouts` rows created in `pending`
  - Status flipped to `finalized` or `pending_organizer_decision`
  - Portfolios converted to `owner_type='user'`

### Task 13: Test payout dashboard (Tremendous sandbox)

- [ ] Switch env to Tremendous sandbox keys
- [ ] As organizer, open `/admin/competitions/<id>/payouts`
- [ ] Verify pending payouts visible, balance check passes
- [ ] Click "Send all"
- [ ] Verify each payout row flips to `sent` with `provider_payout_id` populated
- [ ] Verify "won_payout" notifications fired

### Task 14: Test webhook delivery

- [ ] Use Tremendous sandbox to simulate a `REWARDS.DELIVERED` webhook (or claim a sandbox reward end-to-end via the recipient flow)
- [ ] Verify webhook handler updates the corresponding payout to `delivered` with `paid_at` set

### Task 15: Test manual fallback

- [ ] On a remaining pending payout, click "Mark manual"
- [ ] Enter note "Paid via Venmo, ref XYZ"
- [ ] Verify status → `paid_manually`, audit log row written, notification fired

### Task 16: Test consent revocation

- [ ] In a parent email, click revoke link
- [ ] Verify student account flips to `revoked`, removed from any active challenges, pending payouts held

### Task 17: Cleanup

- [ ] Delete test users
- [ ] Delete pilot challenge or mark `cancelled`
- [ ] Restore env vars to production values

### Task 18: Pilot launch readiness checklist

- [ ] All Tasks 1–17 passed
- [ ] Teacher trained on organizer dashboard (15-min walkthrough)
- [ ] Spanish consent text reviewed by a fluent speaker
- [ ] School communication sent to parents announcing the program
- [ ] Tremendous account funded for actual prize pool
- [ ] Real challenge created with production domain allowlist
- [ ] Status flipped to `registration`
- [ ] Share link distributed by teacher via school's regular channel

---

## Notes

This plan is intentionally a checklist, not code. Any unexpected behavior surfaced here should generate a bug ticket and pause launch until resolved. The smoke test is designed to be re-runnable for future sponsored challenges by varying inputs in Tasks 2–7.
