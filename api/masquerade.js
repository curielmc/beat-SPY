export const config = { runtime: 'edge' }

import { SUPABASE_URL, SUPABASE_SERVICE_KEY } from './_lib/supabase.js'
import { OWNER_EMAIL } from './_lib/constants.js'

const SUPABASE_KEY = SUPABASE_SERVICE_KEY

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Verify caller is admin
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401 })

  const token = authHeader.replace('Bearer ', '')
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_KEY }
  })
  if (!userRes.ok) return new Response('Unauthorized', { status: 401 })

  const caller = await userRes.json()

  // Check admin role
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${caller.id}&select=role,email`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  const profiles = await profileRes.json()
  const callerRole = profiles?.[0]?.role
  const callerEmail = profiles?.[0]?.email?.toLowerCase()

  if (!['admin', 'teacher'].includes(callerRole) && callerEmail !== OWNER_EMAIL) {
    return new Response('Forbidden', { status: 403 })
  }

  const { target_user_id } = await req.json()
  if (!target_user_id) {
    return new Response(JSON.stringify({ error: 'target_user_id required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  const targetProfileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${target_user_id}&select=id,role,email`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  const targetProfiles = await targetProfileRes.json()
  const targetProfile = targetProfiles?.[0] || null
  if (!targetProfile) {
    return new Response(JSON.stringify({ error: 'Target profile not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }

  if (callerRole === 'teacher') {
    if (targetProfile.role !== 'student') {
      return new Response(JSON.stringify({ error: 'Teachers can only view students in their classes' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      })
    }

    const membershipRes = await fetch(
      `${SUPABASE_URL}/rest/v1/class_memberships?user_id=eq.${target_user_id}&select=id,classes!inner(teacher_id)&classes.teacher_id=eq.${caller.id}&limit=1`,
      {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      }
    )
    const memberships = await membershipRes.json().catch(() => [])
    if (!Array.isArray(memberships) || memberships.length === 0) {
      return new Response(JSON.stringify({ error: 'Teachers can only view students in their own classes' }), {
        status: 403, headers: { 'Content-Type': 'application/json' }
      })
    }
  }

  // Get target user's email
  const targetRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${target_user_id}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  })
  if (!targetRes.ok) {
    return new Response(JSON.stringify({ error: 'User not found' }), {
      status: 404, headers: { 'Content-Type': 'application/json' }
    })
  }
  const targetUser = await targetRes.json()
  const targetEmail = targetUser.email

  if (!targetEmail) {
    return new Response(JSON.stringify({ error: 'User has no email' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    })
  }

  // Generate a magic link for the target user using Supabase admin API
  const linkRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'magiclink',
      email: targetEmail
    })
  })

  if (!linkRes.ok) {
    const err = await linkRes.text()
    return new Response(JSON.stringify({ error: 'Failed to generate link: ' + err }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    })
  }

  const linkData = await linkRes.json()

  // The response contains hashed_token and action_link
  // Extract the token_hash and type from the action_link or use properties directly
  return new Response(JSON.stringify({
    email: targetEmail,
    token_hash: linkData.hashed_token,
    action_link: linkData.action_link
  }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
