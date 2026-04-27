# Plan 3 — Share Link, Token-Bound Signup, Parental Consent (EN/ES)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** A shareable challenge link that lets logged-out students sign up (with DOB + parent email if under 18) and auto-registers them after signup; a parent consent flow with a hosted bilingual EN/ES consent page; access gating by email-domain allowlist and roster CSV.

**Architecture:** New public route `/c/<slug>` extends existing `CompetitionDetailView.vue` with public-readable mode. Signup gets DOB + conditional parent fields. A server endpoint `/api/competitions/register` enforces eligibility (status, domain, roster, consent) and is the only path that creates `competition_entries`. Parent consent uses a one-time token in `parental_consent_tokens` (added to schema in this plan) → hosted page → server records the consent.

**Tech stack:** Vue 3 SPA + Supabase auth, Vercel serverless API, Resend (or existing email infra), Twilio Lookup API for phone validation.

**Spec sections covered:** §4, §11, §12.

---

### Task 1: Migration `055_consent_tokens.sql`

**Files:**
- Create: `supabase/migrations/055_consent_tokens.sql`

- [ ] **Step 1:** Migration body

```sql
CREATE TABLE parental_consent_tokens (
  token         text PRIMARY KEY,
  user_id       uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  parent_email  text NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_consent_tokens_user ON parental_consent_tokens(user_id);
ALTER TABLE parental_consent_tokens ENABLE ROW LEVEL SECURITY;
-- Service-role only; no public policy.
```

- [ ] **Step 2:** Push and commit

### Task 2: Bilingual string source

**Files:**
- Create: `src/i18n/parent/en.json`
- Create: `src/i18n/parent/es.json`

- [ ] **Step 1:** Stub EN

```json
{
  "consent_text_version": "v1-2026-04-27",
  "page": {
    "title": "Parental Consent — beat-SPY",
    "intro": "{student_name} would like to participate in beat-SPY, a simulated investing challenge platform. Your consent is required because {student_name} is under 18.",
    "what_we_do": [
      "Browse and register for simulated investing challenges (no real money is invested)",
      "Receive email and (optionally) text-message notifications about challenges",
      "Trade in a simulated portfolio with virtual cash",
      "Receive prize payouts via gift cards or PayPal/Venmo (Tremendous) if they win"
    ],
    "checkbox_participate": "I consent to my child participating in beat-SPY",
    "checkbox_email": "I consent to email notifications to my child",
    "checkbox_sms": "I consent to text-message notifications to my child (Msg & data rates may apply. Reply STOP to opt out.)",
    "parent_name": "Your full name",
    "relationship": "Relationship",
    "relationship_options": ["Parent", "Legal guardian"],
    "signature": "Type your full name to sign",
    "submit": "Submit consent",
    "language_toggle_es": "Español"
  },
  "email": {
    "request_subject": "Consent needed for {student_name} to use beat-SPY",
    "request_body": "Hi,\n\n{student_name} signed up for beat-SPY and asked you to provide consent. Click below to review and consent:\n\n{consent_url}\n\nThis link expires in 14 days.\n\n— beat-SPY"
  }
}
```

- [ ] **Step 2:** ES translation (mirror keys, translated strings).

```json
{
  "consent_text_version": "v1-2026-04-27",
  "page": {
    "title": "Consentimiento parental — beat-SPY",
    "intro": "{student_name} desea participar en beat-SPY, una plataforma de desafíos de inversión simulada. Su consentimiento es necesario porque {student_name} es menor de 18 años.",
    "what_we_do": [
      "Explorar y registrarse en desafíos de inversión simulada (no se invierte dinero real)",
      "Recibir notificaciones por correo electrónico y (opcionalmente) por mensaje de texto",
      "Operar en una cartera simulada con dinero virtual",
      "Recibir premios mediante tarjetas de regalo o PayPal/Venmo (Tremendous) si gana"
    ],
    "checkbox_participate": "Doy mi consentimiento para que mi hijo/a participe en beat-SPY",
    "checkbox_email": "Doy mi consentimiento a las notificaciones por correo electrónico a mi hijo/a",
    "checkbox_sms": "Doy mi consentimiento a las notificaciones por mensaje de texto (pueden aplicarse tarifas de mensajes y datos. Responda STOP para darse de baja.)",
    "parent_name": "Su nombre completo",
    "relationship": "Relación",
    "relationship_options": ["Padre/Madre", "Tutor legal"],
    "signature": "Escriba su nombre completo para firmar",
    "submit": "Enviar consentimiento",
    "language_toggle_es": "English"
  },
  "email": {
    "request_subject": "Se necesita consentimiento para que {student_name} use beat-SPY",
    "request_body": "Hola,\n\n{student_name} se registró en beat-SPY y solicitó su consentimiento. Haga clic abajo para revisar y dar su consentimiento:\n\n{consent_url}\n\nEste enlace expira en 14 días.\n\n— beat-SPY"
  }
}
```

- [ ] **Step 3:** Helper

```js
// src/i18n/parent/index.js
import en from './en.json'
import es from './es.json'
const bundles = { en, es }
export function t(lang, key, vars = {}) {
  const path = key.split('.')
  let v = bundles[lang] || bundles.en
  for (const p of path) v = v?.[p]
  if (typeof v !== 'string') return v
  return v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
}
export function consentTextVersion() { return en.consent_text_version }
```

- [ ] **Step 4:** Commit

### Task 3: Public challenge route `/c/<slug>`

**Files:**
- Modify: `src/router/index.js`
- Modify: `src/views/app/CompetitionDetailView.vue` OR create new `src/views/public/ChallengePublicView.vue`

- [ ] **Step 1:** Router — add a public route resolved by slug, no auth required:

```js
{
  path: '/c/:slug',
  name: 'challenge-public',
  component: () => import('../views/public/ChallengePublicView.vue'),
  meta: { public: true }
}
```

- [ ] **Step 2:** Public view fetches by slug from a public RPC or RLS-permitted SELECT. Replicates header + rules + prizes + leaderboard from `CompetitionDetailView.vue`. Renders **Join** button:
  - Logged-out → `router.push({ name: 'signup', query: { challenge_slug: slug } })`
  - Logged-in → calls `/api/competitions/register`

- [ ] **Step 3:** Commit

### Task 4: Signup form additions (DOB + parent fields + language)

**Files:**
- Modify: `src/views/auth/SignupView.vue`

- [ ] **Step 1:** Add Step 2 fields: `date_of_birth` (required), `parent_email` (visible when `isUnder18(date_of_birth)`), `parent_language` dropdown (EN/ES). Compute `isUnder18` client-side.

```js
function isUnder18(dob) {
  if (!dob) return false
  const d = new Date(dob)
  const cutoff = new Date(); cutoff.setFullYear(cutoff.getFullYear() - 18)
  return d > cutoff
}
```

- [ ] **Step 2:** On submit, if under-18, after `auth.signUp` succeeds, post profile fields to `/api/profile/update` (or directly via supabase client if RLS allows) with DOB + parent_email + parent_language and set `parental_consent_status='pending'`. Then trigger `/api/consent/request` to send the parent email.

- [ ] **Step 3:** If `query.challenge_slug` is present, after signup completes, call `/api/competitions/register` with the slug to auto-register (server returns 422 if consent pending — UI shows "Your account is created, but needs parent consent before you can join. We've emailed your parent.")

- [ ] **Step 4:** Commit

### Task 5: `/api/competitions/register` endpoint

**Files:**
- Create: `api/competitions/register.js`

- [ ] **Step 1:** Handler

```js
export const config = { runtime: 'edge' }
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse, fetchUserFromToken, loadProfile } from '../_lib/supabase.js'

export default async function handler(req) {
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405)
  const user = await fetchUserFromToken(req.headers.get('authorization'))
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  const { slug, thesis } = await req.json()

  const comps = await sbFetch(`/competitions?slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`)
  const comp = comps[0]
  if (!comp) return jsonResponse({ error: 'not_found' }, 404)

  // 1. Status
  const okStatus = comp.status === 'registration' || (comp.status === 'active' && comp.late_join_allowed)
  if (!okStatus) return jsonResponse({ error: 'registration_closed' }, 422)

  // 2. Email-domain allowlist
  if (comp.email_domain_allowlist?.length) {
    const dom = (user.email || '').toLowerCase().split('@')[1]
    if (!comp.email_domain_allowlist.map(d => d.toLowerCase()).includes(dom)) {
      return jsonResponse({ error: 'domain_not_allowed' }, 403)
    }
  }

  // 3. Roster
  const rosterRows = await sbFetch(`/competition_roster?competition_id=eq.${comp.id}&limit=1`)
  if (rosterRows.length) {
    const match = await sbFetch(
      `/competition_roster?competition_id=eq.${comp.id}&email=ilike.${encodeURIComponent(user.email)}&status=eq.invited&limit=1`
    )
    if (!match.length) return jsonResponse({ error: 'not_on_roster' }, 403)
    // flip roster row
    await fetch(`${SUPABASE_URL}/rest/v1/competition_roster?id=eq.${match[0].id}`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'registered', matched_user_id: profile.id, registered_at: new Date().toISOString() })
    })
  }

  // 4. Already registered?
  const existing = await sbFetch(`/competition_entries?competition_id=eq.${comp.id}&user_id=eq.${profile.id}&limit=1`)
  if (existing.length) return jsonResponse({ error: 'already_registered', entry: existing[0] }, 409)

  // 5. Parental consent for under-18
  if (profile.parental_consent_status === 'pending' || profile.parental_consent_status === 'expired') {
    return jsonResponse({ error: 'consent_required' }, 422)
  }
  if (profile.parental_consent_status === 'revoked') {
    return jsonResponse({ error: 'consent_revoked' }, 403)
  }

  // 6. Create dedicated portfolio + entry (transactional via RPC if available; else 2-call)
  const portfolioRes = await fetch(`${SUPABASE_URL}/rest/v1/portfolios`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      owner_type: 'competition',
      owner_id: comp.id,
      name: `${comp.name} — ${profile.full_name}`,
      starting_cash: comp.starting_cash,
      cash: comp.starting_cash
    })
  })
  const portfolio = (await portfolioRes.json())[0]

  const entryRes = await fetch(`${SUPABASE_URL}/rest/v1/competition_entries`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({
      competition_id: comp.id,
      user_id: profile.id,
      portfolio_id: portfolio.id,
      thesis: thesis || null
    })
  })

  return jsonResponse({ ok: true, entry: (await entryRes.json())[0] })
}
```

- [ ] **Step 2:** Commit

### Task 6: `/api/consent/request` — send parent email

**Files:**
- Create: `api/consent/request.js`
- Create: `src/lib/email.js` if no existing helper (factor from `newsletter-send.js`)

- [ ] **Step 1:** Handler

```js
export const config = { runtime: 'edge' }
import { SUPABASE_URL, SUPABASE_SERVICE_KEY, sbFetch, jsonResponse, fetchUserFromToken, loadProfile } from '../_lib/supabase.js'
import { sendEmail } from '../../src/lib/email.js'
import { t, consentTextVersion } from '../../src/i18n/parent/index.js'

export default async function handler(req) {
  const user = await fetchUserFromToken(req.headers.get('authorization'))
  if (!user) return jsonResponse({ error: 'unauthorized' }, 401)
  const profile = await loadProfile(user.id)
  if (!profile.parent_email) return jsonResponse({ error: 'no_parent_email' }, 422)

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  const expires = new Date(Date.now() + 14 * 86400_000).toISOString()
  await fetch(`${SUPABASE_URL}/rest/v1/parental_consent_tokens`, {
    method: 'POST',
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, user_id: profile.id, parent_email: profile.parent_email, expires_at: expires })
  })

  const lang = profile.parent_language || 'en'
  const url = `${process.env.PUBLIC_BASE_URL}/consent/${token}?lang=${lang}`
  const subject = t(lang, 'email.request_subject', { student_name: profile.full_name })
  const body = t(lang, 'email.request_body', { student_name: profile.full_name, consent_url: url })

  // Bilingual stack if language unknown
  const stacked = lang === 'en' ? body : `${t('en','email.request_body',{student_name:profile.full_name,consent_url:url})}\n\n---\n\n${body}`

  await sendEmail({ to: profile.parent_email, subject, text: stacked })
  return jsonResponse({ ok: true })
}
```

- [ ] **Step 2:** Commit

### Task 7: Hosted consent page `/consent/<token>`

**Files:**
- Create: `src/views/public/ConsentView.vue`
- Modify: `src/router/index.js`

- [ ] **Step 1:** Route (public)

```js
{ path: '/consent/:token', name: 'consent', component: () => import('../views/public/ConsentView.vue'), meta: { public: true } }
```

- [ ] **Step 2:** View loads token via `/api/consent/:token` GET (returns student name + lang + consent text version), renders all strings via `t(lang, …)`, has a top-right toggle that swaps `lang` in URL. Submit POSTs to `/api/consent/:token` with parent_name, relationship, signature_text, checkboxes, optional parent_phone/email-copy enrollment.

- [ ] **Step 3:** Commit

### Task 8: `/api/consent/[token].js` GET + POST

**Files:**
- Create: `api/consent/[token].js`

- [ ] **Step 1:** GET returns student info, validates token not used/not expired. POST writes `parental_consents` row, updates `profiles.parental_consent_status='consented'` + `parental_consent_at = now()` + `parental_consent_expires_at = now() + interval '12 months'`. If parent opted into copies, write `parent_subscriptions`. Marks token used. Sends receipt email + revoke link.

- [ ] **Step 2:** Edge cases:
  - token used → 410
  - token expired → 410
  - student already consented (race) → idempotent: still record but flag

- [ ] **Step 3:** Commit

### Task 9: Roster CSV upload (admin)

**Files:**
- Modify: `src/views/admin/CompetitionsAdminView.vue` (add CSV upload)
- Create: `api/competitions/upload-roster.js`

- [ ] **Step 1:** Admin UI component: file input accepts CSV with `email,full_name`. Parses client-side and posts to API.

- [ ] **Step 2:** API validates email format, dedupes, upserts into `competition_roster` with `status='invited'`. Optional `send_invites=true` triggers a roster invitation email batch (notification #10 — implemented in Plan 5; for now just leave a TODO comment that hooks into `sendChallengeNotification` once that exists).

- [ ] **Step 3:** Commit

### Task 10: End-to-end manual smoke test

- [ ] **Step 1:** Create a test challenge with `email_domain_allowlist=['example.test']`, `slug='smoke-test'`
- [ ] **Step 2:** Open `/c/smoke-test` while logged out, click Join, sign up with `kid@example.test` and DOB making student 16. Confirm parent email received with magic link. Click link, complete consent in EN, then toggle to ES and verify rendering. Submit.
- [ ] **Step 3:** After consent submission, return to `/c/smoke-test` and verify auto-registration succeeded; portfolio created; landing on detail page shows "You're registered."
- [ ] **Step 4:** Sign up second user with `kid@gmail.com` → expect `domain_not_allowed`.

---

## Self-review

- [ ] Logged-out signup carries challenge_slug through to auto-register after auth
- [ ] All eligibility checks happen server-side (never trust client)
- [ ] Consent token: 14d expiry, single-use, server-recorded IP/UA
- [ ] EN+ES bundles have identical key shapes
- [ ] Receipt email includes revoke link
- [ ] Public route does not leak roster emails or admin fields
