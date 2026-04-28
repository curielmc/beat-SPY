#!/usr/bin/env node
/**
 * pilot-create-challenge.js
 *
 * Creates the St. Francis pilot challenge directly via Supabase service role.
 * Idempotent on slug: if a competition with this slug already exists it prints
 * the existing row and exits 0.
 *
 * Required env:
 *   SUPABASE_URL              e.g. https://omrfqisqsqgidcqellzy.supabase.co
 *   SUPABASE_SERVICE_KEY      service-role JWT
 *
 * Optional env:
 *   PILOT_SLUG                default: st-francis-hs-spy-2026-05-pilot
 *   PILOT_NAME                default: "St. Francis HS — Beat the S&P 500 (PILOT)"
 *   PILOT_DOMAIN              default: example.test
 *   ADMIN_EMAIL               required if no admin row can be auto-detected
 *
 * Usage:
 *   node scripts/pilot-create-challenge.js
 *
 * See: docs/runbooks/2026-04-27-pilot-smoke-test.md
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in env.')
  console.error('       (SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL are also accepted.)')
  process.exit(1)
}

const SLUG = process.env.PILOT_SLUG || 'st-francis-hs-spy-2026-05-pilot'
const NAME = process.env.PILOT_NAME || 'St. Francis HS — Beat the S&P 500 (PILOT)'
const DOMAIN = process.env.PILOT_DOMAIN || 'example.test'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || null

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const log = (...args) => console.log('[pilot-create]', ...args)

async function findAdminId() {
  if (ADMIN_EMAIL) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', ADMIN_EMAIL)
      .single()
    if (error) throw new Error(`Admin lookup by ADMIN_EMAIL failed: ${error.message}`)
    if (data.role !== 'admin') {
      log(`WARNING: profile ${data.email} has role=${data.role} (not 'admin'). Continuing anyway.`)
    }
    return data.id
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  if (error) throw new Error(`Could not auto-detect admin profile: ${error.message}. Set ADMIN_EMAIL.`)
  log(`auto-detected admin: ${data.email}`)
  return data.id
}

async function main() {
  log(`target Supabase: ${SUPABASE_URL}`)
  log(`target slug:     ${SLUG}`)

  // 1. Bail early if slug already exists.
  const { data: existing, error: existErr } = await supabase
    .from('competitions')
    .select('id, slug, status, name, prize_pool_amount')
    .eq('slug', SLUG)
    .maybeSingle()
  if (existErr) throw existErr
  if (existing) {
    log(`already exists — id=${existing.id}, status=${existing.status}`)
    log('use scripts/pilot-cleanup.js first if you want a clean slate.')
    console.log(JSON.stringify(existing, null, 2))
    return
  }

  const adminId = await findAdminId()

  const now = new Date()
  const startDate = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  const endDate = new Date(now.getTime() + 37 * 24 * 3600 * 1000)

  const prize_allocation = [
    { bucket: 'top_n', n: 1, share_pct: 25 },
    { bucket: 'top_n', n: 2, share_pct: 25, start_at: 2 },
    { bucket: 'beat_benchmark', share_pct: 50 }
  ]

  const rules = {
    default_charity: {
      name: "St. Jude Children's Research Hospital",
      ein: '35-1044585'
    }
  }

  const insertRow = {
    name: NAME,
    sponsor: 'St. Francis HS',
    benchmark_ticker: 'SPY',
    starting_cash: 100000,
    registration_open: now.toISOString(),
    registration_close: startDate.toISOString(),
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
    status: 'draft',
    slug: SLUG,
    universe: { mode: 'sp500_via_spy' },
    email_domain_allowlist: [DOMAIN],
    prize_pool_amount: 1000,
    prize_pool_currency: 'USD',
    prize_allocation,
    unfilled_bucket_policy: 'admin_decide',
    payout_provider: 'tremendous',
    sms_enabled: false,
    show_real_names: true,
    convert_to_individual_on_complete: true,
    late_join_allowed: false,
    digest_frequency: 'weekly',
    rules,
    is_public: true,
    created_by: adminId
  }

  log('inserting competition row...')
  const { data: created, error: insErr } = await supabase
    .from('competitions')
    .insert(insertRow)
    .select('id, slug, status, name')
    .single()
  if (insErr) throw insErr
  log(`created — id=${created.id}, slug=${created.slug}`)

  // Add the admin as the owner organizer (some flows depend on this)
  const { error: orgErr } = await supabase
    .from('competition_organizers')
    .upsert(
      { competition_id: created.id, user_id: adminId, role: 'owner' },
      { onConflict: 'competition_id,user_id' }
    )
  if (orgErr) {
    log(`WARNING: could not insert owner organizer row: ${orgErr.message}`)
  } else {
    log('added admin as owner organizer')
  }

  console.log(JSON.stringify(created, null, 2))
}

main().catch(err => {
  console.error('[pilot-create] FAILED:', err.message || err)
  process.exit(1)
})
