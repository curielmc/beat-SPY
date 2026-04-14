import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase, getAccessToken } from '../lib/supabase'
import { OWNER_EMAIL } from '../lib/constants'

export const useAuthStore = defineStore('auth', () => {
  const currentUser = ref(null)
  const profile = ref(null)
  const loading = ref(true)
  const initialized = ref(false)

  // Admin masquerade — real session swap
  const masqueradeUser = ref(JSON.parse(sessionStorage.getItem('masquerade') || 'null'))
  const _originalSession = ref(JSON.parse(sessionStorage.getItem('masquerade_original') || 'null'))
  const masqueradeActor = ref(JSON.parse(sessionStorage.getItem('masquerade_actor') || 'null'))

  function _clearCaches() {
    allMemberships.value = []
    activeClassId.value = null
    localStorage.removeItem('beatspy_active_class')
    _membershipCacheUid = null
    _membershipCacheTs = 0
    if (typeof window !== 'undefined') window.__clearPortfolioCache = true
  }

  async function startMasquerade(user) {
    // Save the admin's current session so we can restore it later
    const { data: { session: adminSession } } = await supabase.auth.getSession()
    if (!adminSession) return { error: 'No active session' }

    const accessToken = await getAccessToken()
    if (!accessToken) return { error: 'Your admin session expired. Please sign in again.' }

    _originalSession.value = {
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token
    }
    sessionStorage.setItem('masquerade_original', JSON.stringify(_originalSession.value))
    masqueradeActor.value = {
      id: currentUser.value?.id || null,
      email: currentUser.value?.email || null,
      role: profile.value?.role || null
    }
    sessionStorage.setItem('masquerade_actor', JSON.stringify(masqueradeActor.value))

    // Call the masquerade API to get a magic link token for the target user
    try {
      const res = await fetch('/api/masquerade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ target_user_id: user.id || user.userId })
      })

      if (!res.ok) {
        const err = await res.json().catch(async () => ({ error: await res.text().catch(() => 'Masquerade failed') }))
        _originalSession.value = null
        sessionStorage.removeItem('masquerade_original')
        return { error: err.error || 'Masquerade failed' }
      }

      const { email, token_hash } = await res.json()

      // Use verifyOtp to establish a real session as the target user
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: 'magiclink'
      })

      if (error) {
        // Restore admin session on failure
        await supabase.auth.setSession(_originalSession.value)
        _originalSession.value = null
        sessionStorage.removeItem('masquerade_original')
        return { error: 'Session switch failed: ' + error.message }
      }

      // Successfully switched to target user's session
      masqueradeUser.value = { id: data.user.id, email: data.user.email }
      sessionStorage.setItem('masquerade', JSON.stringify(masqueradeUser.value))

      currentUser.value = data.user
      await fetchProfile(data.user.id)
      _clearCaches()

      return { success: true }
    } catch (err) {
      // Restore admin session on error
      if (_originalSession.value) {
        await supabase.auth.setSession(_originalSession.value)
      }
      _originalSession.value = null
      sessionStorage.removeItem('masquerade_original')
      masqueradeActor.value = null
      sessionStorage.removeItem('masquerade_actor')
      return { error: err.message }
    }
  }

  async function stopMasquerade() {
    if (_originalSession.value) {
      // Restore the admin's original session
      await supabase.auth.setSession(_originalSession.value)

      // Reload admin's profile
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        currentUser.value = session.user
        await fetchProfile(session.user.id)
      }
    }

    masqueradeUser.value = null
    _originalSession.value = null
    masqueradeActor.value = null
    sessionStorage.removeItem('masquerade')
    sessionStorage.removeItem('masquerade_original')
    sessionStorage.removeItem('masquerade_actor')
    _clearCaches()
  }

  const isMasquerading = computed(() => !!masqueradeUser.value)
  const effectiveUserId = computed(() => masqueradeUser.value?.id || currentUser.value?.id || null)

  const allMemberships = ref([])
  const activeClassId = ref(localStorage.getItem('beatspy_active_class') || null)

  function setActiveClass(classId) {
    activeClassId.value = classId
    if (classId) {
      localStorage.setItem('beatspy_active_class', classId)
    } else {
      localStorage.removeItem('beatspy_active_class')
    }
  }

  const membership = computed(() => {
    if (!allMemberships.value.length) return null
    return allMemberships.value.find(m => m.class_id === activeClassId.value)
      || allMemberships.value[0]
  })

  const isLoggedIn = computed(() => !!currentUser.value)
  const isTeacher = computed(() => userType.value === 'teacher')
  const isAdmin = computed(() => {
    // Preserve the original actor's admin access during masquerade.
    if (isMasquerading.value) return masqueradeActor.value?.role === 'admin'
    const role = profile.value?.role
    const email = currentUser.value?.email?.toLowerCase()
    // Hardcoded fallback for the owner to prevent lockouts
    if (email === OWNER_EMAIL) return true
    return role === 'admin'
  })

  // Also update userType to reflect the hardcoded admin status
  const userType = computed(() => {
    // During masquerade, show the student's role for the student view
    if (isMasquerading.value) return profile.value?.role || 'student'
    const email = currentUser.value?.email?.toLowerCase()
    if (email === OWNER_EMAIL) return 'admin'
    return profile.value?.role || null
  })

  async function ensureOwnerAdminProfile() {
    const email = currentUser.value?.email?.toLowerCase()
    if (email !== OWNER_EMAIL || profile.value?.role === 'admin') return

    const { data, error } = await supabase
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', currentUser.value.id)
      .select()
      .single()

    if (error) {
      console.error('[AUTH] ensureOwnerAdminProfile error:', error)
      return
    }

    profile.value = data
    console.log('[AUTH] ensureOwnerAdminProfile: promoted owner account to admin')
  }

  async function handleDisabledProfile(profileData) {
    if (!profileData?.is_disabled) return null
    const message = profileData.merge_note || 'This account has been merged into another account. Please use the surviving login.'
    await supabase.auth.signOut()
    currentUser.value = null
    profile.value = null
    return { error: message }
  }

  async function _handleAutoJoin(session) {
    if (profile.value?.role === 'student' && session.user.email) {
      const { data: existing } = await supabase
        .from('class_memberships')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)
      if (!existing || existing.length === 0) {
        const invite = await checkEmailInvite(session.user.email)
        if (invite) {
          console.log('[AUTH] auto-joining class from invite:', invite.class_code)
          // Update name from invite if it's just the email prefix
          if (profile.value.full_name === session.user.email.split('@')[0]) {
            await updateProfile({ full_name: invite.full_name })
          }
          await joinClass(invite.class_code, null, null, invite.id)
        }
      }
    }
  }

  // Initialize auth state from session
  async function init() {
    if (initialized.value) return
    loading.value = true
    try {
      // Recover session from localStorage
      console.log('[AUTH] init: calling getSession...')
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
      console.log('[AUTH] init: getSession result:', { hasSession: !!session, userId: session?.user?.id, expiresAt: session?.expires_at, error: sessionErr })
      if (session?.user) {
        currentUser.value = session.user
        const profileResult = await requireProfile(
          session.user.id,
          'Your saved session is missing its profile. Please sign in again.'
        )
        if (profileResult.error) return
        if (await handleDisabledProfile(profileResult.profile)) return
        await ensureOwnerAdminProfile()

        // Handle auto-join in background — don't block app loading
        _handleAutoJoin(session).catch(e => console.warn('[AUTH] auto-join error:', e))
      }
    } finally {
      loading.value = false
      initialized.value = true
    }

    // Listen for auth state changes (after init completes)
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[AUTH] onAuthStateChange:', event, { hasSession: !!session, userId: session?.user?.id })
      // Skip side effects during masquerade session switches
      if (isMasquerading.value || _originalSession.value) return

      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        currentUser.value = session.user
        const profileResult = await requireProfile(
          session.user.id,
          'Your account signed in, but the profile is not available yet. Please try again.'
        )
        if (profileResult.error) return
        if (await handleDisabledProfile(profileResult.profile)) return
        await ensureOwnerAdminProfile()

        // Auto-join class if student has a pending invite and no memberships (non-blocking)
        if (event === 'SIGNED_IN') {
          _handleAutoJoin(session).catch(e => console.warn('[AUTH] auto-join error:', e))
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser.value = null
        profile.value = null
        _clearCaches()
      }
    })
  }

  async function fetchProfile(userId) {
    if (!userId) return null
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (!error && data) {
      console.log('[AUTH] fetchProfile success:', data.email, 'role:', data.role)
      profile.value = data
    } else if (error) {
      console.error('[AUTH] fetchProfile error:', error)
    }
    return data
  }

  async function waitForProfile(userId, {
    timeoutMs = 4000,
    intervalMs = 250
  } = {}) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const data = await fetchProfile(userId)
      if (data) return data
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    return null
  }

  const _profileRequests = new Map()

  async function requireProfile(userId, fallbackMessage = 'We could not load your account profile. Please try again.') {
    if (!userId) return { error: 'No user ID provided' }
    
    // Deduplicate in-flight profile requests for the same user
    if (_profileRequests.has(userId)) {
      console.log('[AUTH] requireProfile: using existing request for', userId)
      return _profileRequests.get(userId)
    }

    const promise = (async () => {
      console.log('[AUTH] requireProfile: starting wait for', userId)
      const profileData = await waitForProfile(userId, { timeoutMs: 4000 })
      if (profileData) {
        console.log('[AUTH] requireProfile: SUCCESS for', userId)
        return { profile: profileData }
      }

      console.warn('[AUTH] requireProfile: TIMEOUT for', userId, 'signing out...')
      await supabase.auth.signOut()
      currentUser.value = null
      profile.value = null
      return { error: fallbackMessage }
    })().finally(() => {
      _profileRequests.delete(userId)
    })

    _profileRequests.set(userId, promise)
    return promise
  }

  // Email/Password signup
  async function signup({ email, password, fullName, role = 'student' }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role
        }
      }
    })
    if (error) return { error: error.message }
    currentUser.value = data.user
    const profileResult = await requireProfile(
      data.user.id,
      'Your account was created, but your student profile is not ready yet. Please try logging in again in a moment.'
    )
    if (profileResult.error) return profileResult
    return { user: data.user }
  }

  // Email/Password login
  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) return { error: error.message }
    currentUser.value = data.user
    // For login (not signup), the profile already exists — fetch it directly
    // instead of polling for up to 8 seconds
    const profileData = await fetchProfile(data.user.id)
    if (!profileData) {
      // Fallback: brief retry in case of transient delay
      await new Promise(r => setTimeout(r, 500))
      const retry = await fetchProfile(data.user.id)
      if (!retry) {
        await supabase.auth.signOut()
        currentUser.value = null
        profile.value = null
        return { error: 'Your account authenticated, but your profile could not be loaded. Please contact your teacher or try again shortly.' }
      }
    }
    const disabled = await handleDisabledProfile(profile.value)
    if (disabled) return disabled
    return { user: data.user }
  }

  // OAuth (Google/Apple)
  async function signInWithOAuth(provider) {
    // Force redirect to the apex domain if on production/vercel
    let redirectBase = window.location.origin
    const host = window.location.hostname.toLowerCase()
    if (host.includes('beat-spy.vercel.app') || host.includes('beat-snp.com')) {
      redirectBase = 'https://beat-snp.com'
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectBase + '/leaderboard'
      }
    })
    if (error) return { error: error.message }
    return { url: data.url }
  }

  // Update profile (e.g., after OAuth to set role)
  async function updateProfile(updates) {
    if (!currentUser.value) return { error: 'Not logged in' }
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', currentUser.value.id)
      .select()
      .single()
    if (error) return { error: error.message }
    profile.value = data
    return { profile: data }
  }

  // Join a class
  async function joinClass(classCode, groupId = null, newGroupName = null, inviteId = null) {
    if (!currentUser.value) return { error: 'Not logged in' }

    // Look up the class by code
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('*')
      .eq('code', classCode.toUpperCase())
      .single()
    if (classError || !classData) return { error: 'Invalid class code' }

    // Check if email is blocked
    const { data: blocked } = await supabase
      .from('blocked_emails')
      .select('id')
      .eq('class_id', classData.id)
      .eq('email', profile.value.email.toLowerCase())
      .maybeSingle()
    if (blocked) return { error: 'You have been removed from this class and cannot rejoin.' }

    // Check if already a member
    const { data: existing } = await supabase
      .from('class_memberships')
      .select('id')
      .eq('user_id', currentUser.value.id)
      .eq('class_id', classData.id)
      .maybeSingle()
    if (existing) return { error: 'You are already in this class.' }

    let finalGroupId = null

    // If invite has a group_name, look up the matching group
    if (!groupId && !newGroupName && inviteId) {
      const { data: inviteData } = await supabase
        .from('class_invites')
        .select('group_name')
        .eq('id', inviteId)
        .maybeSingle()
      if (inviteData?.group_name) {
        const { data: matchedGroup } = await supabase
          .from('groups')
          .select('id')
          .eq('class_id', classData.id)
          .ilike('name', inviteData.group_name)
          .maybeSingle()
        if (matchedGroup) {
          finalGroupId = matchedGroup.id
        }
      }
    }

    if (!finalGroupId && classData.group_mode !== 'teacher_assign') {
      if (newGroupName) {
        // Create new group
        const { data: newGroup, error: groupError } = await supabase
          .from('groups')
          .insert({ class_id: classData.id, name: newGroupName })
          .select()
          .single()
        if (groupError) return { error: 'Failed to create group: ' + groupError.message }
        finalGroupId = newGroup.id

        // Create portfolio for the new group (use class starting_cash)
        const classCash = classData.starting_cash || 100000
        await supabase.from('portfolios').insert({
          owner_type: 'group',
          owner_id: newGroup.id,
          starting_cash: classCash,
          cash_balance: classCash,
          fund_starting_cash: classCash,
          allow_reset: classData.allow_reset || false
        })
      } else if (groupId) {
        finalGroupId = groupId
      }
    }

    // Insert class membership
    const { error: memberError } = await supabase
      .from('class_memberships')
      .insert({
        user_id: currentUser.value.id,
        class_id: classData.id,
        group_id: finalGroupId
      })
    if (memberError) return { error: 'Failed to join class: ' + memberError.message }

    // Create personal portfolio for this student (every student gets $100k individual portfolio)
    const { data: existingPersonal } = await supabase
      .from('portfolios')
      .select('id')
      .eq('owner_type', 'user')
      .eq('owner_id', currentUser.value.id)
      .maybeSingle()

    if (!existingPersonal) {
      await supabase.from('portfolios').insert({
        owner_type: 'user',
        owner_id: currentUser.value.id,
        starting_cash: 100000,
        cash_balance: 100000,
        allow_reset: true
      })
    }

    // Mark invite as joined if provided
    if (inviteId) {
      await supabase.rpc('mark_invite_joined', { invite_id: inviteId })
    }

    return { success: true, classData, groupId: finalGroupId }
  }

  // Check if an email has a pending class invite
  async function checkEmailInvite(emailAddr) {
    const { data, error } = await supabase.rpc('find_class_invite_by_email', {
      lookup_email: emailAddr
    })
    if (error || !data || data.length === 0) return null
    return data[0]
  }

  // Validate a class code (for signup flow)
  async function validateClassCode(code) {
    const { data, error } = await supabase
      .from('classes')
      .select('*, teacher:profiles!classes_teacher_id_fkey(full_name)')
      .eq('code', code.toUpperCase())
      .single()
    if (error || !data) return null
    return data
  }

  // Get groups for a class
  async function getGroupsForClass(classId) {
    const { data, error } = await supabase
      .from('groups')
      .select('*, memberships:class_memberships(user_id, profiles:profiles(full_name))')
      .eq('class_id', classId)
    if (error) return []
    return data
  }

  // Get current user's class memberships (all classes)
  let _membershipCacheUid = null
  let _membershipCacheTs = 0
  const MEMBERSHIP_TTL = 5 * 60 * 1000 // 5 minutes

  async function getCurrentMembership(force = false) {
    if (!currentUser.value) return null
    const uid = effectiveUserId.value  // use masquerade user if active
    const now = Date.now()
    // Return cached result if fresh and same user
    if (!force && allMemberships.value.length &&
        _membershipCacheUid === uid &&
        (now - _membershipCacheTs) < MEMBERSHIP_TTL) {
      return membership.value
    }
    const { data, error } = await supabase
      .from('class_memberships')
      .select('*, class:classes(*), group:groups(*)')
      .eq('user_id', uid)
    if (error) return null
    allMemberships.value = data || []
    _membershipCacheUid = uid
    _membershipCacheTs = now
    // Set activeClassId to first if not set or not found
    if (allMemberships.value.length && !allMemberships.value.find(m => m.class_id === activeClassId.value)) {
      setActiveClass(allMemberships.value[0].class_id)
    }
    return membership.value
  }

  // Get group members
  async function getGroupMembers(groupId) {
    if (!groupId) return []
    const { data, error } = await supabase
      .from('class_memberships')
      .select('user_id, profiles:profiles(id, full_name, email, avatar_url)')
      .eq('group_id', groupId)
    if (error) return []
    return data.map(m => m.profiles)
  }

  // Fetch any public profile by username or id (no auth needed)
  async function fetchPublicProfile(usernameOrId) {
    // Try username first
    let { data } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, bio, investment_philosophy, is_public, role, created_at')
      .eq('username', usernameOrId)
      .eq('is_public', true)
      .maybeSingle()

    if (!data) {
      // Try by id
      const result = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, bio, investment_philosophy, is_public, role, created_at')
        .eq('id', usernameOrId)
        .eq('is_public', true)
        .maybeSingle()
      data = result.data
    }

    return data
  }

  // Fetch public portfolios for a user
  async function fetchPublicPortfolios(userId) {
    const { data } = await supabase
      .from('portfolios')
      .select('*')
      .eq('owner_type', 'user')
      .eq('owner_id', userId)
      .eq('is_public', true)
    return data || []
  }

  // Logout
  async function logout() {
    await supabase.auth.signOut()
    currentUser.value = null
    profile.value = null
    _clearCaches()
  }

  return {
    currentUser, profile, loading, initialized,
    isLoggedIn, userType, isTeacher, isAdmin,
    allMemberships, activeClassId, membership, setActiveClass,
    init, fetchProfile, signup, login, signInWithOAuth,
    updateProfile, joinClass, validateClassCode, checkEmailInvite,
    startMasquerade, stopMasquerade, isMasquerading, masqueradeUser, effectiveUserId,
    masqueradeActor,
    getGroupsForClass, getCurrentMembership, getGroupMembers,
    fetchPublicProfile, fetchPublicPortfolios, logout
  }
})
