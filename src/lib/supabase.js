import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Migrate any session stuck under the old custom key back to default
const DEFAULT_KEY = `sb-${supabaseUrl?.split('//')[1]?.split('.')[0]}-auth-token`
const OLD_CUSTOM_KEY = 'beatsnp-auth'
if (DEFAULT_KEY && OLD_CUSTOM_KEY !== DEFAULT_KEY) {
  const stuckSession = localStorage.getItem(OLD_CUSTOM_KEY)
  if (stuckSession && !localStorage.getItem(DEFAULT_KEY)) {
    localStorage.setItem(DEFAULT_KEY, stuckSession)
  }
  localStorage.removeItem(OLD_CUSTOM_KEY)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

/**
 * Get a valid access token, refreshing if needed.
 * Use this instead of supabase.auth.getSession() in components.
 */
export async function getAccessToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) return session.access_token
    // Session expired in memory — try refreshing
    const { data: refreshed } = await supabase.auth.refreshSession()
    return refreshed?.session?.access_token || null
  } catch {
    return null
  }
}

export function getMasqueradeActorToken() {
  try {
    return JSON.parse(sessionStorage.getItem('masquerade_original') || 'null')?.access_token || null
  } catch {
    return null
  }
}

export async function uploadAvatar(userId, file) {
  const ext = file.name.split('.').pop()
  const path = `${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadGroupAvatar(groupId, file) {
  const ext = file.name.split('.').pop()
  const path = `groups/${groupId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadTutorialDeck(tutorialSlug, file) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const safeSlug = (tutorialSlug || 'tutorial')
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'tutorial'
  const path = `tutorial-decks/${safeSlug}-${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type || 'application/pdf' })

  if (error) throw error

  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}
