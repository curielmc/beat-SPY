// Pure resolver: given an entry, the competition row, and the system default,
// return the charity record to use (a jsonb-like { ein?, name, ... }) or null.
//
// Order:
//   1. entry.charity_choice (if present and non-empty)
//   2. competition.default_charity (if present and non-empty)
//   3. systemDefault (if present and non-empty)
//   4. null — caller should mark the payout failed with 'no_charity_resolved'.

export function resolveCharityDestination(entry, comp, systemDefault) {
  const candidates = [
    entry?.charity_choice,
    comp?.default_charity,
    systemDefault
  ]
  for (const c of candidates) {
    if (c && typeof c === 'object' && Object.keys(c).length > 0) return c
  }
  return null
}
