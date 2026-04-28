#!/usr/bin/env node
/**
 * pilot-cleanup.js
 *
 * Deletes ALL pilot smoke-test data scoped to:
 *   - the pilot competition (slug = $PILOT_SLUG)
 *   - all profiles with email LIKE '%@example.test'
 *   - their portfolios, consent rows, consent tokens, and auth.users
 *
 * Idempotent. Safe to re-run. Refuses to run unless the operator types "yes"
 * (or PILOT_CLEANUP_CONFIRM=yes is set in env, e.g. for CI).
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY
 *
 * Optional env:
 *   PILOT_SLUG                default: st-francis-hs-spy-2026-05-pilot
 *   PILOT_DOMAIN              default: example.test
 *   PILOT_CLEANUP_CONFIRM     set to 'yes' to skip the interactive prompt
 *
 * Usage:
 *   node scripts/pilot-cleanup.js
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import readline from 'node:readline'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in env.')
  process.exit(1)
}

const SLUG = process.env.PILOT_SLUG || 'st-francis-hs-spy-2026-05-pilot'
const DOMAIN = process.env.PILOT_DOMAIN || 'example.test'
const EMAIL_LIKE = `%@${DOMAIN}`

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const log = (...args) => console.log('[pilot-cleanup]', ...args)

async function confirm() {
  if (process.env.PILOT_CLEANUP_CONFIRM === 'yes') {
    log('PILOT_CLEANUP_CONFIRM=yes — skipping prompt')
    return true
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(
      `\nThis will DELETE the competition with slug "${SLUG}" and ALL profiles matching "${EMAIL_LIKE}".\nType "yes" to continue: `,
      answer => {
        rl.close()
        resolve(answer.trim().toLowerCase() === 'yes')
      }
    )
  })
}

async function preview() {
  const { data: comp } = await supabase
    .from('competitions')
    .select('id, slug, status, name')
    .eq('slug', SLUG)
    .maybeSingle()

  const { data: users, count: userCount } = await supabase
    .from('profiles')
    .select('id, email', { count: 'exact' })
    .ilike('email', EMAIL_LIKE)

  log(`competition match: ${comp ? `${comp.id} (${comp.status})` : '<none>'}`)
  log(`profile matches: ${userCount ?? 0}`)
  if (users?.length) {
    users.forEach(u => log(`  - ${u.email} (${u.id})`))
  }
  return { comp, userIds: (users || []).map(u => u.id) }
}

async function safeDelete(table, query) {
  const { error, count } = await query.select('*', { count: 'exact', head: true })
  // count from head:true gives the matched row count BEFORE delete, which Supabase
  // doesn't return on .delete() chains directly — fall back to a plain delete:
  const { error: delErr } = await query
  if (delErr) {
    log(`  ${table}: ERROR ${delErr.message}`)
  } else {
    log(`  ${table}: deleted (matched ~${count ?? '?'})`)
  }
}

async function deleteWhere(table, column, values) {
  if (!values || values.length === 0) {
    log(`  ${table}: skipped (no matching ids)`)
    return
  }
  const { error } = await supabase.from(table).delete().in(column, values)
  if (error) log(`  ${table}: ERROR ${error.message}`)
  else log(`  ${table}: deleted rows where ${column} in (${values.length} ids)`)
}

async function deleteEq(table, column, value) {
  const { error } = await supabase.from(table).delete().eq(column, value)
  if (error) log(`  ${table}: ERROR ${error.message}`)
  else log(`  ${table}: deleted rows where ${column} = ${value}`)
}

async function main() {
  log(`target Supabase: ${SUPABASE_URL}`)
  log(`target slug:     ${SLUG}`)
  log(`target domain:   ${DOMAIN}`)

  const { comp, userIds } = await preview()

  if (!comp && userIds.length === 0) {
    log('Nothing to clean up. Exiting.')
    return
  }

  const ok = await confirm()
  if (!ok) {
    log('Aborted by user.')
    process.exit(2)
  }

  // 1. Delete competition-scoped child rows first
  if (comp) {
    log(`removing rows scoped to competition ${comp.id}...`)
    for (const t of [
      'competition_payouts',
      'competition_notifications',
      'competition_audit_log',
      'competition_roster',
      'competition_organizers',
      'competition_entries'
    ]) {
      await deleteEq(t, 'competition_id', comp.id)
    }
    await deleteEq('competitions', 'id', comp.id)
  }

  // 2. Delete user-scoped rows for @example.test profiles
  if (userIds.length > 0) {
    log(`removing rows for ${userIds.length} test profile(s)...`)
    // Tokens / consents / parental records (best-effort across known tables)
    await deleteWhere('parental_consent_tokens', 'user_id', userIds)
    await deleteWhere('parental_consents', 'user_id', userIds)

    // Portfolios — column name varies between schemas; try both.
    {
      const { error } = await supabase.from('portfolios').delete().in('owner_user_id', userIds)
      if (error && /column .* does not exist/i.test(error.message)) {
        const { error: e2 } = await supabase.from('portfolios').delete().in('user_id', userIds)
        if (e2) log(`  portfolios: ERROR ${e2.message}`)
        else log('  portfolios: deleted (matched on user_id)')
      } else if (error) {
        log(`  portfolios: ERROR ${error.message}`)
      } else {
        log('  portfolios: deleted (matched on owner_user_id)')
      }
    }

    // Profiles
    await deleteWhere('profiles', 'id', userIds)

    // auth.users — service role can delete via admin API
    for (const id of userIds) {
      const { error } = await supabase.auth.admin.deleteUser(id)
      if (error) log(`  auth.users[${id}]: ERROR ${error.message}`)
      else log(`  auth.users[${id}]: deleted`)
    }
  }

  // 3. Verification pass
  log('verification:')
  const { count: compCount } = await supabase
    .from('competitions')
    .select('id', { count: 'exact', head: true })
    .eq('slug', SLUG)
  const { count: profCount } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('email', EMAIL_LIKE)
  log(`  competitions matching slug: ${compCount ?? 0} (expect 0)`)
  log(`  profiles matching ${EMAIL_LIKE}: ${profCount ?? 0} (expect 0)`)

  if ((compCount ?? 0) === 0 && (profCount ?? 0) === 0) {
    log('cleanup complete.')
  } else {
    log('cleanup INCOMPLETE — manual SQL may be needed (see runbook §Cleanup).')
    process.exit(3)
  }
}

main().catch(err => {
  console.error('[pilot-cleanup] FAILED:', err.message || err)
  process.exit(1)
})
