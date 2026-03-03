import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://omrfqisqsqgidcqellzy.supabase.co',
  'sb_publishable_QuQs_U9GlK9Vr-Dk889DNg_95g-c9IH'
)

// Sign in as teacher to have RLS access
const email = process.argv[2]
const password = process.argv[3]

if (!email || !password) {
  console.log('Usage: node scripts/assign_invited_students.js <teacher-email> <teacher-password>')
  process.exit(1)
}

const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1) }

// Get all classes
const { data: classes } = await supabase.from('classes').select('id, class_name, code')
console.log(`Found ${classes.length} class(es)`)

for (const cls of classes) {
  console.log(`\n--- ${cls.class_name} (${cls.code}) ---`)

  // Get invites with group_name
  const { data: invites } = await supabase
    .from('class_invites')
    .select('*')
    .eq('class_id', cls.id)
    .not('group_name', 'is', null)

  if (!invites?.length) { console.log('  No invites with group assignments'); continue }

  // Get groups for this class
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('class_id', cls.id)

  // Get memberships
  const { data: memberships } = await supabase
    .from('class_memberships')
    .select('id, user_id, group_id, profiles:profiles(email, full_name)')
    .eq('class_id', cls.id)

  console.log(`  ${invites.length} invites, ${groups.length} groups, ${memberships.length} memberships`)

  let assigned = 0
  for (const inv of invites) {
    // Find the group
    const group = groups.find(g => g.name.toLowerCase() === inv.group_name.toLowerCase())
    if (!group) { console.log(`  ⚠ No group found for "${inv.group_name}"`); continue }

    // Find membership by email match
    const member = memberships.find(m =>
      m.profiles?.email?.toLowerCase() === inv.email?.toLowerCase()
    )
    if (!member) continue // Student hasn't signed up yet
    if (member.group_id === group.id) { console.log(`  ✓ ${inv.full_name} already in ${inv.group_name}`); continue }

    // Assign to group
    const { error } = await supabase
      .from('class_memberships')
      .update({ group_id: group.id })
      .eq('id', member.id)

    if (error) {
      console.log(`  ✗ Failed to assign ${inv.full_name}: ${error.message}`)
    } else {
      console.log(`  ✓ Assigned ${inv.full_name} → ${inv.group_name}`)
      assigned++
    }
  }
  console.log(`  ${assigned} student(s) assigned`)
}

await supabase.auth.signOut()
console.log('\nDone!')
