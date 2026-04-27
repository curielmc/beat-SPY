# Plan 5 — Notifications (Email + In-App + SMS)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Wire the 10 notification triggers from spec §9 across email, in-app, and (where appropriate) SMS via Twilio. Single dispatcher `sendChallengeNotification(type, competitionId, userId, data)` writes in-app + queues email + queues SMS.

**Architecture:** A new `competition_notifications` table for in-app rows. Resend (or whatever the existing email provider is — confirm during Task 1) sends emails. Twilio sends SMS gated by `profiles.sms_opt_in` AND `competitions.sms_enabled`. Templates live in `src/notifications/templates/<type>.js`, each exporting `email({lang, data})`, `sms({lang, data})`, `inApp({data})`. Daily cron `challenge-lifecycle.js` (created in Plan 2) picks up time-window triggers (#2, #4, #5).

**Tech stack:** Resend (fallback assumption — confirm), Twilio, Supabase.

**Spec sections covered:** §9.

---

### Task 1: Confirm + factor email provider

**Files:**
- Read: `api/newsletter-send.js` to identify the existing email provider
- Create: `src/lib/email.js` (re-export with consistent signature)

- [ ] **Step 1:** Read newsletter-send.js. Note which env vars and SDK it uses. Don't introduce a new provider.

- [ ] **Step 2:** Factor a simple `sendEmail({ to, subject, text, html })` helper that delegates to the same provider. If no provider is wired, add Resend (`RESEND_API_KEY`).

- [ ] **Step 3:** Commit

### Task 2: `competition_notifications` table

**Files:**
- Create: `supabase/migrations/056_competition_notifications.sql`

- [ ] **Step 1:** Migration

```sql
CREATE TABLE competition_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  competition_id  uuid REFERENCES competitions(id) ON DELETE CASCADE,
  type            text NOT NULL,
  data            jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at         timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_competition_notifications_user_unread
  ON competition_notifications(user_id, created_at DESC) WHERE read_at IS NULL;

ALTER TABLE competition_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user reads own notifs" ON competition_notifications
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "user marks own notifs read" ON competition_notifications
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2:** Push and commit

### Task 3: Notification templates

**Files:**
- Create: `src/notifications/templates/registered.js`
- Create: `src/notifications/templates/start-tomorrow.js`
- Create: `src/notifications/templates/started.js`
- Create: `src/notifications/templates/digest.js`
- Create: `src/notifications/templates/end-tomorrow.js`
- Create: `src/notifications/templates/finalized.js`
- Create: `src/notifications/templates/won-payout.js`
- Create: `src/notifications/templates/rule-change.js`
- Create: `src/notifications/templates/removed.js`
- Create: `src/notifications/templates/roster-invitation.js`

- [ ] **Step 1:** Each file exports an object:

```js
// e.g., src/notifications/templates/won-payout.js
export default {
  type: 'won_payout',
  channels: { email: true, inApp: true, sms: true },
  email({ lang, data }) {
    return {
      subject: lang === 'es'
        ? `🎉 Has ganado $${data.amount} en ${data.competitionName}`
        : `🎉 You won $${data.amount} in ${data.competitionName}`,
      text: lang === 'es'
        ? `Felicitaciones — ganaste $${data.amount}. Reclama tu premio antes del ${data.claimBy}: ${data.claimUrl}`
        : `Congrats — you won $${data.amount}. Claim by ${data.claimBy}: ${data.claimUrl}`
    }
  },
  sms({ lang, data }) {
    return lang === 'es'
      ? `🎉 ¡Ganaste $${data.amount} en ${data.competitionName}! Reclama: ${data.claimUrl}`
      : `🎉 You won $${data.amount} in ${data.competitionName}! Claim: ${data.claimUrl}`
  },
  inApp({ data }) {
    return { title: `You won $${data.amount}`, body: `In ${data.competitionName}. Claim by ${data.claimBy}.` }
  }
}
```

Repeat the pattern for each of the 10 types. Channels per the spec table in §9.2.

- [ ] **Step 2:** Index file `src/notifications/templates/index.js` exports a map by type.

- [ ] **Step 3:** Commit

### Task 4: Twilio SMS sender

**Files:**
- Create: `src/lib/twilio.js`

- [ ] **Step 1:** Helper

```js
// src/lib/twilio.js
const SID = process.env.TWILIO_ACCOUNT_SID
const TOKEN = process.env.TWILIO_AUTH_TOKEN
const FROM = process.env.TWILIO_FROM_NUMBER

export async function sendSms(to, body) {
  if (!SID || !TOKEN || !FROM) {
    console.warn('Twilio not configured; skipping SMS')
    return { skipped: true }
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`
  const auth = btoa(`${SID}:${TOKEN}`)
  const params = new URLSearchParams({ From: FROM, To: to, Body: body })
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`twilio ${res.status}: ${data.message}`)
  return data
}

export async function lookupPhone(phoneE164) {
  if (!SID || !TOKEN) return { valid: null }
  const auth = btoa(`${SID}:${TOKEN}`)
  const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phoneE164)}?Fields=line_type_intelligence`
  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } })
  if (!res.ok) return { valid: false }
  const j = await res.json()
  return { valid: j.valid, type: j.line_type_intelligence?.type }
}
```

- [ ] **Step 2:** Commit

### Task 5: Dispatcher `sendChallengeNotification`

**Files:**
- Create: `src/notifications/dispatch.js` (server-only — uses service role)

- [ ] **Step 1:** Implementation

```js
// src/notifications/dispatch.js
import templates from './templates/index.js'
import { sendEmail } from '../lib/email.js'
import { sendSms } from '../lib/twilio.js'
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch } from '../../api/_lib/supabase.js'

export async function sendChallengeNotification(type, competitionId, userId, data = {}) {
  const tpl = templates[type]
  if (!tpl) throw new Error(`Unknown notification type: ${type}`)

  const profile = (await sbFetch(`/profiles?id=eq.${userId}&select=id,email,full_name,phone_e164,sms_opt_in`))[0]
  if (!profile) return { skipped: 'no_profile' }
  const comp = competitionId
    ? (await sbFetch(`/competitions?id=eq.${competitionId}&select=id,name,sms_enabled,digest_frequency`))[0]
    : null
  const lang = data.lang || 'en'

  // In-app
  if (tpl.channels.inApp) {
    const inApp = tpl.inApp({ data })
    await fetch(`${SUPABASE_URL}/rest/v1/competition_notifications`, {
      method: 'POST',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, competition_id: competitionId, type, data: { ...inApp, ...data } })
    })
  }

  // Email
  const isCritical = type === 'won_payout' || type === 'removed'
  if (tpl.channels.email && profile.email) {
    const e = tpl.email({ lang, data })
    await sendEmail({ to: profile.email, subject: e.subject, text: e.text, html: e.html })
  }

  // SMS
  const smsOk = profile.sms_opt_in && profile.phone_e164 && (comp?.sms_enabled !== false)
  if (tpl.channels.sms && (smsOk || isCritical) && profile.phone_e164) {
    try { await sendSms(profile.phone_e164, tpl.sms({ lang, data })) }
    catch (e) { console.error('sms failed', e) }
  }

  return { ok: true }
}
```

- [ ] **Step 2:** Commit

### Task 6: Wire triggers — synchronous events

**Files:**
- Modify: `api/competitions/register.js` → emit `registered`
- Modify: `api/competitions/[id]/remove-entry.js` → emit `removed`
- Modify: `api/competitions/[id]/update.js` → emit `rule_change` for each entrant when material fields change

- [ ] **Step 1:** Add `await sendChallengeNotification(...)` after the primary mutation completes. Failures must not roll back the mutation — wrap in try/catch + log.

- [ ] **Step 2:** Commit

### Task 7: Cron-driven triggers (#2 start-tomorrow, #3 started, #4 digest, #5 end-tomorrow)

**Files:**
- Modify: `api/cron/challenge-lifecycle.js`

- [ ] **Step 1:** Extend lifecycle cron with windowed scans:

```js
async function emitStartReminders(today) {
  const rows = await sbFetch(`/competitions?status=in.(registration,active)&select=id,name,start_date,entries:competition_entries(user_id)`)
  for (const c of rows) {
    const start = new Date(c.start_date)
    const hoursUntil = (start - new Date()) / 3_600_000
    if (hoursUntil > 22 && hoursUntil <= 26) {
      for (const e of c.entries) await sendChallengeNotification('start_tomorrow', c.id, e.user_id, { competitionName: c.name })
    }
  }
}
async function emitStarted(today) { /* status flipped to active today and start_date <= now */ }
async function emitEndReminders(today) { /* mirror of emitStartReminders for end_date */ }
async function emitDigests(today) {
  // For each active comp, check digest_frequency and last_digest_sent (new field) — daily / weekly cadence
  // For each entrant: build summary { rank, return, spy_return, days_remaining } + send 'digest'
}
```

- [ ] **Step 2:** Track `last_digest_sent` per challenge — add column via migration `057_digest_tracking.sql`:

```sql
ALTER TABLE competitions ADD COLUMN last_digest_sent_at timestamptz;
```

- [ ] **Step 3:** Commit

### Task 8: Profile settings — SMS opt-in toggle

**Files:**
- Modify: `src/views/app/SettingsView.vue` (or wherever user profile lives)
- Create: `api/profile/sms-optin.js`

- [ ] **Step 1:** UI: phone input (E.164), opt-in checkbox with TCPA disclosure text, "Save" button. On save, call API.

- [ ] **Step 2:** API: validate phone via `lookupPhone(phone)`. If invalid, return 422. If valid mobile, write `phone_e164`, `sms_opt_in=true`, `sms_opt_in_at=now()`. Send a confirmation SMS ("You're opted in to beat-SPY texts. Reply STOP to opt out.")

- [ ] **Step 3:** Commit

### Task 9: Twilio STOP webhook

**Files:**
- Create: `api/webhooks/twilio-status.js`

- [ ] **Step 1:** Twilio inbound message webhook. Parse body, look up `From` number → flip `profiles.sms_opt_in=false` if message body matches STOP/STOPALL/CANCEL/UNSUBSCRIBE/QUIT. (Twilio also handles this carrier-side; this is a mirror.) Verify signature using Twilio's signature validation pattern.

- [ ] **Step 2:** Configure webhook URL in Twilio console → `https://<host>/api/webhooks/twilio-status`

- [ ] **Step 3:** Commit

### Task 10: 10DLC registration checklist

- [ ] **Step 1:** Register a 10DLC brand + campaign in Twilio console. Campaign use case = "Higher Education" or "Account Notifications". Provide sample messages from `won-payout`, `start-tomorrow`, `roster-invitation` templates.

- [ ] **Step 2:** Wait for approval (often <24h). Once approved, swap `TWILIO_FROM_NUMBER` to the registered number.

- [ ] **Step 3:** Commit (no code) — this is an ops checklist captured in `docs/runbooks/twilio-10dlc.md`.

---

## Self-review

- [ ] All 10 trigger types have a template file
- [ ] Critical notifications (#7, #9) bypass user opt-out
- [ ] SMS gated by both user opt-in AND challenge sms_enabled
- [ ] Cron uses time windows that survive ±2h drift
- [ ] STOP keyword mirrored to DB (defense in depth)
- [ ] Notification failures don't block the primary mutation
