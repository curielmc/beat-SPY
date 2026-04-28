// Server-only notification dispatcher.
// Writes in-app row + sends email + sends SMS, gated by per-template channels and
// the user's opt-in / challenge sms_enabled flags.
//
// Critical types ('won_payout', 'removed') bypass user opt-out gating per spec §9.2.

import templates from './templates/index.js'
import { sendEmail } from '../lib/email.js'
import { sendSms } from '../lib/twilio.js'

const CRITICAL_TYPES = new Set(['won_payout', 'removed'])

// Default helpers — overridable for tests.
const defaultDeps = {
  async loadProfile(userId, fetchImpl) {
    const url = `${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=id,email,full_name,phone_e164,sms_opt_in,parent_language`
    const res = await fetchImpl(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    })
    if (!res.ok) return null
    const rows = await res.json().catch(() => [])
    return rows?.[0] || null
  },
  async loadCompetition(competitionId, fetchImpl) {
    if (!competitionId) return null
    const url = `${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/rest/v1/competitions?id=eq.${competitionId}&select=id,name,sms_enabled,digest_frequency`
    const res = await fetchImpl(url, {
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    })
    if (!res.ok) return null
    const rows = await res.json().catch(() => [])
    return rows?.[0] || null
  },
  async insertInApp(row, fetchImpl) {
    const url = `${process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL}/rest/v1/competition_notifications`
    return fetchImpl(url, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify(row)
    })
  },
  sendEmail,
  sendSms
}

export async function sendChallengeNotification(type, competitionId, userId, data = {}, deps = {}) {
  const tpl = templates[type]
  if (!tpl) throw new Error(`Unknown notification type: ${type}`)

  const D = { ...defaultDeps, ...deps }
  const fetchImpl = deps.fetch || globalThis.fetch
  const profile = await D.loadProfile(userId, fetchImpl)
  if (!profile) return { skipped: 'no_profile' }

  const comp = await D.loadCompetition(competitionId, fetchImpl)
  const lang = data.lang || profile.parent_language || 'en'
  const isCritical = CRITICAL_TYPES.has(type)

  const result = { type, userId, competitionId, channels: {} }

  // In-app
  if (tpl.channels.inApp && typeof tpl.inApp === 'function') {
    try {
      const inApp = tpl.inApp({ data })
      await D.insertInApp({
        user_id: userId,
        competition_id: competitionId || null,
        type,
        data: { ...inApp, ...data }
      }, fetchImpl)
      result.channels.inApp = 'sent'
    } catch (e) {
      console.error('[dispatch] in-app failed', e)
      result.channels.inApp = `error: ${e.message}`
    }
  }

  // Email
  if (tpl.channels.email && typeof tpl.email === 'function' && profile.email) {
    try {
      const e = tpl.email({ lang, data })
      await D.sendEmail({ to: profile.email, subject: e.subject, text: e.text, html: e.html })
      result.channels.email = 'sent'
    } catch (e) {
      console.error('[dispatch] email failed', e)
      result.channels.email = `error: ${e.message}`
    }
  }

  // SMS — gated on user opt-in AND competition.sms_enabled, UNLESS critical.
  if (tpl.channels.sms && typeof tpl.sms === 'function' && profile.phone_e164) {
    const userOptedIn = profile.sms_opt_in === true
    const compAllowsSms = comp ? comp.sms_enabled !== false : true
    const allowed = isCritical || (userOptedIn && compAllowsSms)
    if (allowed) {
      try {
        const body = tpl.sms({ lang, data })
        const r = await D.sendSms(profile.phone_e164, body)
        result.channels.sms = r?.skipped ? 'skipped' : 'sent'
      } catch (e) {
        console.error('[dispatch] sms failed', e)
        result.channels.sms = `error: ${e.message}`
      }
    } else {
      result.channels.sms = 'gated'
    }
  }

  return result
}

export const __test__ = { CRITICAL_TYPES }
