// Material fields trigger an audit log entry and a participant notification
// when changed mid-challenge (status='active'). Used by both the client
// (confirmation dialog) and server (audit + notification dispatch).
export const MATERIAL_FIELDS = [
  'universe',
  'start_date',
  'end_date',
  'prize_pool_amount',
  'prize_allocation',
  'rules',
  'benchmark_ticker'
]

// Detect changes to material fields. Returns a map of { field: { before, after } }
// for changed fields only. Treats deep-ish equality via JSON stringify.
export function detectMaterialChanges(before = {}, after = {}) {
  const changes = {}
  for (const field of MATERIAL_FIELDS) {
    if (!(field in after)) continue
    const a = before?.[field]
    const b = after[field]
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[field] = { before: a ?? null, after: b ?? null }
    }
  }
  return changes
}
