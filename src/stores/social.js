import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

export const useSocialStore = defineStore('social', () => {
  const myFollowing = ref([]) // array of followed user IDs
  const followingLoaded = ref(false)

  // ============================================
  // FOLLOWS
  // ============================================

  async function loadMyFollowing() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) {
      myFollowing.value = []
      followingLoaded.value = true
      return
    }

    const { data } = await supabase
      .from('follows')
      .select('followed_id')
      .eq('follower_id', session.user.id)

    myFollowing.value = (data || []).map(f => f.followed_id)
    followingLoaded.value = true
  }

  function isFollowing(userId) {
    return myFollowing.value.includes(userId)
  }

  async function followUser(userId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user || session.user.id === userId) return { error: "Can't follow yourself" }

    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: session.user.id, followed_id: userId })

    if (error) return { error: error.message }

    myFollowing.value.push(userId)
    return { success: true }
  }

  async function unfollowUser(userId) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: 'Not logged in' }

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', session.user.id)
      .eq('followed_id', userId)

    if (error) return { error: error.message }

    myFollowing.value = myFollowing.value.filter(id => id !== userId)
    return { success: true }
  }

  async function getFollowerCount(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('follower_count')
      .eq('id', userId)
      .maybeSingle()
    return data?.follower_count || 0
  }

  // ============================================
  // TAKES
  // ============================================

  async function fetchTakesForTicker(ticker, limit = 20) {
    const { data, error } = await supabase
      .from('investment_theses')
      .select('*, profiles:user_id(full_name, username, avatar_url)')
      .eq('ticker', ticker)
      .not('side', 'is', null)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return []
    return data || []
  }

  async function postTake({ ticker, side, body, targetPrice, targetDate, priceAtCreation }) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return { error: 'Not logged in' }

    const { data, error } = await supabase
      .from('investment_theses')
      .insert({
        user_id: session.user.id,
        ticker,
        side,
        body,
        title: null,
        target_price: targetPrice,
        target_date: targetDate,
        price_at_creation: priceAtCreation,
        is_public: true,
        outcome: 'pending'
      })
      .select('*, profiles:user_id(full_name, username, avatar_url)')
      .single()

    if (error) {
      if (error.code === '23505') return { error: 'You already posted a take on this stock today' }
      return { error: error.message }
    }
    return { success: true, data }
  }

  async function checkCanPost(ticker) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return false

    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('investment_theses')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('ticker', ticker)
      .not('side', 'is', null)
      .gte('created_at', today + 'T00:00:00')
      .lte('created_at', today + 'T23:59:59')
      .limit(1)

    return !data?.length
  }

  // ============================================
  // FEED
  // ============================================

  async function fetchFeed(limit = 30) {
    if (!myFollowing.value.length) return []

    const { data, error } = await supabase
      .from('investment_theses')
      .select('*, profiles:user_id(full_name, username, avatar_url)')
      .in('user_id', myFollowing.value)
      .not('side', 'is', null)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return []
    return data || []
  }

  // ============================================
  // OUTCOME RESOLUTION
  // ============================================

  async function resolveTake(takeId, currentPrice) {
    const { data: take } = await supabase
      .from('investment_theses')
      .select('*')
      .eq('id', takeId)
      .single()

    if (!take || take.outcome !== 'pending') return

    const today = new Date().toISOString().slice(0, 10)
    if (take.target_date > today) return // not expired yet

    let outcome
    if (take.side === 'bull') {
      outcome = currentPrice >= Number(take.target_price) ? 'correct' : 'incorrect'
    } else {
      outcome = currentPrice <= Number(take.target_price) ? 'correct' : 'incorrect'
    }

    await supabase
      .from('investment_theses')
      .update({ outcome, outcome_resolved_at: new Date().toISOString() })
      .eq('id', takeId)

    return outcome
  }

  return {
    myFollowing,
    followingLoaded,
    loadMyFollowing,
    isFollowing,
    followUser,
    unfollowUser,
    getFollowerCount,
    fetchTakesForTicker,
    postTake,
    checkCanPost,
    fetchFeed,
    resolveTake
  }
})
