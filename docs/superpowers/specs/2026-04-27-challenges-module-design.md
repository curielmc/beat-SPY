# Challenges Module — Design Spec

**Date:** 2026-04-27
**Status:** Approved, ready for implementation plan
**First pilot:** St. Francis High School, "Beat the S&P 500 in 30 days"

---

## 1. Goal

Robust challenge/competition system where an admin or per-challenge organizer can run time-bounded investing competitions against a benchmark (default SPY). Sponsors fund prize pools; participants register via a share link; winners receive payouts through Tremendous.

## 2. Non-goals (v1)

- SMS beyond Twilio
- Stripe Connect / direct bank-account payouts
- Risk-adjusted scoring (Sharpe, Sortino)
- Trade restrictions beyond universe + min_stocks + max_position_pct
- Team / multi-user portfolios within a challenge
- Bracketed / multi-round challenges
- Cross-challenge season standings
- Full app i18n (only parent-facing surfaces are bilingual)
- Magic-link-only signup (regular signup is fine)

## 3. Data model

Existing tables: `competitions`, `competition_entries`, `portfolios` (with `owner_type='competition'`).

### 3.1 `competitions` — new columns

| Column | Type | Notes |
|---|---|---|
| `slug` | `text unique` | Share URL `/c/<slug>`, auto-generated from name, editable |
| `share_token` | `text unique nullable` | Optional opaque token for `/c/<slug>?t=<token>` |
| `universe` | `jsonb` | `{ mode, tickers, snapshot_date }` where mode ∈ `('app_all','sp500_via_spy','custom_list','exclude_list')` |
| `email_domain_allowlist` | `text[]` | e.g., `['stfrancishs.org']`; null = no domain gate |
| `prize_pool_amount` | `numeric` | Total $ pool |
| `prize_pool_currency` | `text default 'USD'` | |
| `prize_allocation` | `jsonb` | Array of buckets (see 3.2) |
| `unfilled_bucket_policy` | `text check in ('roll_forward','return_to_sponsor','admin_decide')` | Default `admin_decide` |
| `payout_provider` | `text default 'tremendous'` | |
| `convert_to_individual_on_complete` | `bool default true` | |
| `show_real_names` | `bool default true` | Public leaderboard naming |
| `sms_enabled` | `bool default true` | Per-challenge SMS toggle |
| `late_join_allowed` | `bool default false` | Whether registration stays open after `start_date` |
| `digest_frequency` | `text default 'weekly'` | `('off','daily','weekly')` |

**Removed:** the existing flat `prizes jsonb` column — superseded by `prize_pool_amount` + `prize_allocation`. Migration converts existing rows into a single `top_n` allocation bucket.

### 3.2 Prize allocation bucket shape

```json
{
  "eligibility": "top_n" | "top_n_who_beat_benchmark" | "all_who_beat_benchmark" | "place",
  "n": 3,
  "place_range": [2, 3],
  "allocation": { "type": "fixed_amount" | "percent_of_pool", "value": 250 },
  "split": "equal_split" | "weighted_by_rank" | "winner_take_all",
  "weights": [50, 30, 20]
}
```

Buckets evaluated top-down. Validation at save: percent buckets sum ≤ 100; fixed buckets sum ≤ pool; non-overlapping place ranges.

### 3.3 New tables

**`competition_organizers`**
```
competition_id uuid, user_id uuid, role text check in ('owner','organizer','viewer'),
PRIMARY KEY (competition_id, user_id)
```
RLS: organizers/owners can `UPDATE`/`SELECT` their own challenges; viewers `SELECT` only.

**`competition_roster`**
```
id uuid pk, competition_id uuid, email text, full_name text,
status text check in ('invited','registered','rejected') default 'invited',
matched_user_id uuid nullable, invited_at timestamptz, registered_at timestamptz nullable,
UNIQUE (competition_id, lower(email))
```

**`competition_audit_log`**
```
id uuid pk, competition_id uuid, actor_id uuid, action text,
before jsonb, after jsonb, created_at timestamptz default now()
```
Append-only. Records every mid-challenge edit, organizer change, kick, finalize, payout action.

**`competition_payouts`**
```
id uuid pk, competition_id uuid, user_id uuid, amount numeric, currency text,
provider text default 'tremendous', provider_payout_id text nullable,
status text check in ('pending','sent','delivered','failed','canceled','paid_manually'),
manual_note text nullable, claimed_at timestamptz nullable, paid_at timestamptz nullable,
error text nullable, created_at timestamptz default now()
```

**`spy_constituents`**
```
ticker text, weight numeric, as_of_date date,
PRIMARY KEY (ticker, as_of_date)
```
Refreshed daily by cron from SSGA's holdings CSV.

**`parental_consents`**
```
id uuid pk, user_id uuid, parent_name text, parent_email text, parent_phone_e164 text nullable,
relationship text, consented_at timestamptz, ip inet, user_agent text,
consent_text_version text, consent_locale text check in ('en','es'),
signature_text text, revoked_at timestamptz nullable, revoked_reason text nullable
```
Append-only audit. Active consent = most recent row with `revoked_at is null` and not expired.

**`parent_subscriptions`**
```
id uuid pk, parent_email text, user_id uuid,
notify_email bool default true, notify_sms bool default false,
parent_phone_e164 text nullable, language text default 'en' check in ('en','es'),
created_at timestamptz default now()
```

### 3.4 `competition_entries` — new columns

| Column | Type | Notes |
|---|---|---|
| `status` | `text default 'active' check in ('active','removed','dq')` | |
| `removed_reason` | `text nullable` | |
| `beat_benchmark` | `bool nullable` | Set at finalize |
| `excess_return_pct` | `numeric nullable` | Set at finalize |

### 3.5 `profiles` — new columns

| Column | Type | Notes |
|---|---|---|
| `date_of_birth` | `date nullable` | |
| `parent_email` | `text nullable` | |
| `parent_language` | `text default 'en' check in ('en','es')` | |
| `parental_consent_status` | `text default 'not_required' check in ('not_required','pending','consented','revoked','expired')` | |
| `parental_consent_at` | `timestamptz nullable` | |
| `parental_consent_expires_at` | `timestamptz nullable` | 12 months out |
| `phone_e164` | `text nullable` | E.164 mobile, validated via Twilio Lookup |
| `sms_opt_in` | `bool default false` | |
| `sms_opt_in_at` | `timestamptz nullable` | |

## 4. Access control & join flow

### 4.1 Share link

Every challenge has `/c/<slug>` (publicly readable: name, sponsor, rules, prizes, leaderboard). The "Join" button is the gate.

### 4.2 Join branches

1. **Logged in + eligible** → instant register, redirect to fresh challenge portfolio.
2. **Logged in + ineligible** → show reason ("This challenge is for stfrancishs.org students only") + organizer contact.
3. **Logged out** → standard signup with challenge ID stashed in signed cookie. Real name + DOB required. After signup, auto-register and land in challenge portfolio.

### 4.3 Eligibility check (run at register-attempt, in order)

1. `status` ∈ `('registration','active')`. If `active`, require `late_join_allowed = true`.
2. If `email_domain_allowlist` is set, user's verified email domain must match.
3. If `competition_roster` has rows for this competition, user's email must match an `invited` row (case-insensitive). On match, roster row → `registered`, `matched_user_id` set.
4. Not already in `competition_entries` for this competition.
5. If user is under 18 (DOB indicates), `parental_consent_status` must be `consented`.

### 4.4 Roster CSV

Admin uploads CSV with columns `email,full_name`. Mismatch (right domain, not on roster) is rejected by default; admin can toggle "approve roster mismatches" to send to a queue.

### 4.5 Real names

Leaderboard shows real names when `show_real_names = true` (default). Sponsored public challenges may flip off — leaderboard shows "First L." format.

## 5. Universe enforcement

Hooked into the existing trade-submit endpoint via a single `assertTickerAllowed(competitionId, ticker)` call. Modes:

- **`app_all`** — no restriction.
- **`sp500_via_spy`** — ticker must be in the challenge's `universe.snapshot_date` row of `spy_constituents`. Snapshot is taken at challenge `start_date` and frozen for the challenge's lifetime.
- **`custom_list`** — ticker must be in `universe.tickers`.
- **`exclude_list`** — ticker must NOT be in `universe.tickers`.

### 5.1 SPY constituents source

Daily cron job pulls SSGA's public holdings CSV (URL stored in config; fallback to previous day's snapshot on fetch failure with admin warning). Writes to `spy_constituents` keyed by `as_of_date`.

### 5.2 Trade UI surfacing

When trading inside a challenge portfolio, show universe constraint inline ("S&P 500 stocks only — 503 tickers allowed as of 2026-04-01"). Violations show a constraint-named error.

## 6. Scoring & finalization

### 6.1 Live leaderboard

- Sort by `current_return_pct desc`
- Each row: rank, real name, return %, **vs SPY: ±X.XX%** (excess return, color-coded), "Beat SPY ✓" badge if currently above SPY, portfolio value, # holdings
- Top of leaderboard: SPY benchmark line ("SPY: +2.34%") as non-ranking pseudo-entry

### 6.2 Finalization

Triggered by daily cron (or manual organizer action) when `now() > end_date AND status = 'active'`:

1. Snapshot final portfolio value per entry → write `final_return_pct`.
2. Compute SPY return over `[start_date, end_date]`, store on competition row.
3. Per entry: `beat_benchmark = (final_return_pct > spy_return)`, `excess_return_pct = final_return_pct - spy_return`.
4. Sort by `final_return_pct desc`, write `final_rank`. Ties get equal rank.
5. Resolve `prize_allocation` against ranked + beat-benchmark data → list of `(user_id, amount)` proposals.
6. If any bucket can't be filled and `unfilled_bucket_policy = 'admin_decide'`, status → `pending_organizer_decision`, notify organizer. Else apply policy and continue.
7. Write `competition_payouts` rows in `pending` status.
8. Convert challenge portfolios to individual portfolios: `owner_type = 'user'`, `owner_id = user_id`, name = "[Challenge Name] portfolio". Holdings preserved. Existing individual portfolio (if any) is kept separately.
9. Emit "results ready" notification (Section 9).

Status → `finalized`.

### 6.3 Tie behavior in prize buckets

- `equal_split` bucket: tied entries split that bucket's allocation evenly.
- `winner_take_all` bucket: ties split between tied winners.

## 7. Prize allocation builder

Admin form (extends `CompetitionsAdminView.vue`):

**Top:** Total Prize Pool input ($ + currency).

**Preset picker (5 options):**
1. Winner takes all
2. Top 3 (50/30/20 weighted)
3. Everyone who beats SPY (equal split)
4. Hybrid: 25% to 1st, 25% split among 2nd–3rd, 50% split among the rest who beat SPY
5. Custom (opens bucket builder)

**Bucket builder:** vertical drag-to-reorder cards. Each card: dropdowns for the four bucket fields. Live preview pane simulates allocation against a 10-participant ranking.

**Validation at save:**
- Percent allocations sum ≤ 100 (warn if <100)
- Fixed amounts sum ≤ pool (error if >)
- ≥1 bucket
- Non-overlapping place ranges

**Unfilled-bucket policy:** radio (Roll forward / Return to sponsor / Ask me at finalization). Default: Ask me at finalization.

## 8. Organizer role & admin operations

### 8.1 Organizer assignment

Admin form has an "Organizers" panel: search-and-add by email/username, assign role. Owner is creator by default; transferable, not removable. Organizers shown on challenge detail page as "Organized by [name]".

### 8.2 Mid-challenge edits

Edits to material fields (universe, dates, prize_pool_amount, prize_allocation, rules) trigger:
1. Confirmation dialog ("This change will be logged and notifies all participants.")
2. Entry in `competition_audit_log`
3. Notification #8 (rule change diff) to all active entrants

Non-material edits (description, sponsor logo, organizer list) skip participant notification but write audit log.

### 8.3 Removing a participant

Sets `competition_entries.status = 'removed'`, requires `removed_reason`, drops from leaderboard, audit-logged, notifies the entrant. Portfolio preserved; converted to individual at finalize.

### 8.4 Cancellation

Owner action. Status → `cancelled`. Active portfolios converted to individual immediately (or per-challenge: refunded to user, depending on stage). Pending payouts canceled; sponsor refund logged.

## 9. Notifications

### 9.1 Channels

- **Email** (Resend, or whatever the app uses; confirm during implementation)
- **In-app** (existing `notifications` table if present, else add `competition_notifications`)
- **SMS** (Twilio, gated by user `sms_opt_in` AND challenge `sms_enabled`)

### 9.2 Triggers

| # | Trigger | Audience | Email | In-app | SMS |
|---|---|---|---|---|---|
| 1 | Entry registered | Entrant | ✅ | ✅ | – |
| 2 | T-24h before start | Entrants | ✅ | – | ✅ |
| 3 | At start | Entrants | ✅ | ✅ | ✅ |
| 4 | Digest (daily/weekly per challenge) | Entrants | ✅ | – | – |
| 5 | T-24h before end | Entrants | ✅ | – | ✅ |
| 6 | Finalization complete | Entrants | ✅ | ✅ | ✅ |
| 7 | Won a payout | Winners | ✅ | ✅ | ✅ |
| 8 | Mid-challenge rule change | Active entrants | ✅ | ✅ | – |
| 9 | Removed from challenge | Removed entrant | ✅ | – | ✅ |
| 10 | Roster invitation | Roster emails (pre-signup) | ✅ | – | – |

Critical (#7, #9) bypass user preference toggles.

### 9.3 Implementation

Single helper `sendChallengeNotification(type, competitionId, userId, data)` writes in-app row + queues email + queues SMS if applicable. Cron-scheduled triggers (#2, #4, #5) handled by the daily finalization cron.

### 9.4 Twilio setup

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` env vars
- 10DLC campaign registered before launch
- STOP keyword handled by Twilio + mirrored to `profiles.sms_opt_in = false` via webhook
- Twilio Lookup API validates phone numbers at save time

## 10. Tremendous payout integration

### 10.1 Setup

- `TREMENDOUS_API_KEY` (production) + `TREMENDOUS_SANDBOX_KEY` env vars
- One Tremendous Campaign defining payout methods (Venmo + PayPal + Amazon GC at minimum); ID stored as `TREMENDOUS_CAMPAIGN_ID`
- Pre-funded balance via ACH or card; balance read via `GET /funding_sources`

### 10.2 Flow

1. **Finalization** writes `competition_payouts` rows in `pending`, no `provider_payout_id`.
2. **Organizer reviews** payout dashboard: proposed list + balance check + "Send payouts" button. Nothing leaves until they click.
3. **On send:** for each pending row, server calls `POST /orders` with `(campaign_id, recipient_email, recipient_name, amount, currency)`. Returned `order_id` + `reward_id` stored in `provider_payout_id`. Status → `sent`. Tremendous emails the winner; we also fire notification #7 with a link to our internal status page.
4. **Winner claims** at Tremendous's hosted UI.
5. **Status webhook** (`POST /api/webhooks/tremendous`): verify HMAC, look up by `provider_payout_id`, update `status` and `paid_at`. Failed rows surface in organizer dashboard.
6. **Refund/cancel:** unclaimed after Tremendous's window (default 90d) auto-cancels; balance returns. Webhook flips row to `canceled`.

### 10.3 Manual fallback

Organizer can flip any payout to **manual** mode → `status = 'paid_manually'` + `manual_note`. No provider call. Used for non-cash prizes, Tremendous outage, or organizer preference. All audit-logged.

### 10.4 Tax / 1099

Tremendous tracks per-recipient annual totals and issues 1099-MISCs over $600/year. Out of our scope.

## 11. Parental consent flow (under-18 users)

### 11.1 Signup

- `date_of_birth` always required
- If DOB < 18 (computed at signup): `parent_email` required, `parent_language` dropdown (EN/ES, default from browser locale), optional `parent_phone_e164`
- Account created in `parental_consent_status = 'pending'`
- User can browse challenges, see leaderboards. Cannot register, trade, or claim prizes.

### 11.2 Consent request

Automatic email to parent in `parent_language` (or bilingual stacked if unknown), magic link to `/consent/<token>?lang=<en|es>`.

### 11.3 Consent page

Server-rendered in `parent_language`, top-right EN/ES toggle. Shows:
- Student name + (if applicable) the challenge they want to join
- Plain-English/Spanish summary of what's permitted (browse, register, email + SMS notifications, trade simulated portfolios, win Tremendous prizes)
- Data practices summary + ToS / privacy links
- Consent checkboxes: participation, email notifications, SMS notifications
- Optional: parent enrolls themselves for "important-only" copies (registration, results, payouts) at parent email/phone in `parent_language`
- Signature: typed full name, relationship dropdown (parent / legal guardian)

On submit:
- Append row to `parental_consents` with `consent_locale` = active locale, `signature_text`, IP, user agent, `consent_text_version`
- `profiles.parental_consent_status = 'consented'`, `parental_consent_at = now()`, `parental_consent_expires_at = now() + interval '12 months'`
- If parent opted into copies: write `parent_subscriptions` row
- Receipt email to parent (signed copy + revoke link)
- Student in-app banner flips to "You're in"

### 11.4 Renewal

T-14d before expiry: parent renewal email. No action by expiry → `parental_consent_status = 'expired'`, student frozen until renewal.

### 11.5 Revocation

Revoke link in every parent email. On revoke:
- Append `parental_consents` row with `revoked_at` set
- `profiles.parental_consent_status = 'revoked'`
- Remove from active `competition_entries` (status `removed`, reason `parental_consent_revoked`)
- Pending payouts: held for organizer decision

### 11.6 Edge cases

- Parent email = student email → reject at signup
- No parent response: nudge at 24h, 7d. Auto-purge pending account at 14d.
- Student turns 18 mid-life: existing consent stays valid until expiry; after expiry self-consents as adult.
- DOB misrepresentation: covered by ToS attestation, not engineered.

## 12. Bilingual surfaces (parent-facing only)

- Translation source: `i18n/parent/{en,es}.json`
- Edits to consent text bump `consent_text_version`
- All parent emails, SMS, and the consent page render in `parent_language`
- Static, human-reviewed translations (no runtime auto-translate) — legal text needs to be precise
- Out of scope: app UI, student-side language preference, languages beyond EN/ES

## 13. Frontend changes

### 13.1 Public

- New route: `/c/<slug>` — public challenge detail page (replace or extend existing `CompetitionDetailView.vue`)
- New route: `/consent/<token>` — parent consent page
- Updated signup flow: DOB field, conditional parent fields, language picker

### 13.2 App

- Updated `CompetitionsView.vue` (challenge listing)
- Updated `CompetitionDetailView.vue` (member view of challenge with portfolio, leaderboard, rules)
- Trade screens: universe constraint surfacing
- Profile settings: phone, SMS opt-in toggle

### 13.3 Admin / Organizer

- Updated `CompetitionsAdminView.vue` with: prize allocation builder, organizer panel, roster CSV upload, bilingual roster invite preview
- New: payout dashboard per challenge (proposed payouts, balance, send button, status table)
- New: audit log viewer per challenge

## 14. Backend / API

- New endpoints: `POST /api/competitions/:id/register`, `POST /api/competitions/:id/finalize`, `POST /api/competitions/:id/payouts/send`, `POST /api/webhooks/tremendous`, `POST /api/webhooks/twilio`, `POST /api/consent/:token`, `GET /api/consent/:token`
- Trade endpoint extended with `assertTickerAllowed` call
- Cron jobs: daily SSGA SPY constituents fetch, daily challenge lifecycle (start reminders, end reminders, finalization, consent renewals, account purges)

## 15. Open questions to resolve during implementation

1. Confirm existing email provider (Resend assumed)
2. Confirm existing notifications table or add `competition_notifications`
3. Confirm Vue store / auth flow patterns (`useAuthStore`, `useCompetitionsStore`)
4. SSGA CSV URL stability — codify in single config file
5. Whether existing signup form already collects `full_name` (likely yes)

## 16. Risks

- **Tremendous funding gap mid-batch** — pre-flight balance check + atomic per-payout flips
- **SSGA fetch failure** — previous-day fallback, admin warning
- **Mid-challenge edit abuse** — audit log + participant notification mitigates; lock-rules-at-start toggle deferred to v2
- **Parent doesn't act on consent email** — auto-nudge + 14d purge prevents zombie accounts
- **DOB lying** — ToS attestation covers; not engineered
- **10DLC campaign rejection** — register early; bilingual templates pre-reviewed

## 17. Phased rollout suggestion (within v1)

Even though we're shipping the full vertical, internal sequencing:

1. **Schema + migrations** (all tables, no UI yet)
2. **Universe enforcement + SPY constituents cron** (testable in isolation)
3. **Share link + signup token flow + parental consent flow + bilingual emails**
4. **Prize allocation builder + organizer role + audit log**
5. **Notifications (email + in-app, then SMS)**
6. **Tremendous integration + payout dashboard**
7. **St. Francis pilot dry-run** — full end-to-end with test users before announcing

This sequencing lets us validate each subsystem independently and gives a clear path to staging gates.
