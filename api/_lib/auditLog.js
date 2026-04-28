import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './supabase.js'

// Best-effort audit log writer. Never throws; failures are logged but do not
// block the primary mutation. Callers should `await` but ignore the return value.
export async function writeAudit({ competitionId, actorId, action, before = null, after = null }) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/competition_audit_log`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        competition_id: competitionId,
        actor_id: actorId,
        action,
        before,
        after
      })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[auditLog] write failed', res.status, text)
      return { ok: false, error: text }
    }
    return { ok: true }
  } catch (err) {
    console.error('[auditLog] write threw', err)
    return { ok: false, error: String(err) }
  }
}
