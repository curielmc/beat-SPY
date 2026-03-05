import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Migrate old session storage key to new one (one-time)
const NEW_STORAGE_KEY = 'beatsnp-auth'
const OLD_STORAGE_KEY = `sb-${supabaseUrl?.split('//')[1]?.split('.')[0]}-auth-token`
if (!localStorage.getItem(NEW_STORAGE_KEY) && OLD_STORAGE_KEY) {
  const oldSession = localStorage.getItem(OLD_STORAGE_KEY)
  if (oldSession) {
    localStorage.setItem(NEW_STORAGE_KEY, oldSession)
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    storageKey: NEW_STORAGE_KEY,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
})

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
