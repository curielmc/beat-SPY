// Format student names as "First L." for newsletter privacy.
// Disambiguate clashes (two "Chloe L."s) by extending the last name until unique.
//
// Input:  array of full names ["Chloe Lawrence", "Chloe Lee", "Marco Diaz"]
// Output: Map<fullName, displayName>

export function buildNameDisplayMap(fullNames) {
  const map = new Map()
  if (!Array.isArray(fullNames)) return map

  // Group by first name + first letter of last name
  const groups = new Map()
  for (const full of fullNames) {
    if (!full) continue
    const parts = String(full).trim().split(/\s+/)
    const first = parts[0] || 'Student'
    const last = parts.slice(1).join(' ') || ''
    const key = `${first}|${(last[0] || '').toLowerCase()}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ full, first, last })
  }

  for (const [, members] of groups) {
    if (members.length === 1) {
      const { full, first, last } = members[0]
      const initial = last ? `${last[0]}.` : ''
      map.set(full, initial ? `${first} ${initial}` : first)
      continue
    }
    // Conflict: extend last name until each is unique within group.
    let len = 2
    while (true) {
      const seen = new Set()
      let allUnique = true
      for (const m of members) {
        const stub = m.last.slice(0, len) + (m.last.length > len ? '.' : '')
        const display = `${m.first} ${stub}`
        if (seen.has(display)) { allUnique = false; break }
        seen.add(display)
      }
      if (allUnique || len > 20) break
      len++
    }
    for (const m of members) {
      const stub = m.last.slice(0, len) + (m.last.length > len ? '.' : '')
      map.set(m.full, `${m.first} ${stub}`)
    }
  }

  return map
}

export function formatStudentName(fullName) {
  if (!fullName) return 'Student'
  const parts = String(fullName).trim().split(/\s+/)
  const first = parts[0] || 'Student'
  const last = parts.slice(1).join(' ')
  if (!last) return first
  return `${first} ${last[0]}.`
}
