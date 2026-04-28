import { ref, watch } from 'vue'
import { supabase } from '../lib/supabase.js'

// Loads the active competition (if any) attached to a portfolio. Used by trade
// surfaces to surface universe constraints inline before the user clicks buy.
export function useChallengeContext(portfolioIdRef) {
  const challenge = ref(null)
  watch(
    portfolioIdRef,
    async (id) => {
      challenge.value = null
      if (!id) return
      const { data, error } = await supabase
        .from('competition_entries')
        .select('competition_id, competitions(id,name,universe,status,end_date)')
        .eq('portfolio_id', id)
        .maybeSingle()
      if (error) console.warn('[useChallengeContext] fetch failed:', error.message)
      if (data?.competitions?.status === 'active') {
        challenge.value = data.competitions
      }
    },
    { immediate: true }
  )
  return { challenge }
}

export function universeLabel(universe) {
  const mode = universe?.mode || 'app_all'
  if (mode === 'app_all') return 'all stocks'
  if (mode === 'sp500_via_spy') return 'S&P 500 stocks only'
  if (mode === 'custom_list') {
    const list = universe?.tickers || []
    return `a custom list (${list.length} ticker${list.length === 1 ? '' : 's'})`
  }
  if (mode === 'exclude_list') {
    const list = universe?.tickers || []
    return `all stocks except ${list.length} restricted ticker${list.length === 1 ? '' : 's'}`
  }
  return mode
}

// Pure check used by the UI to decide whether to disable the trade button. Mirrors
// the server-side assertTickerAllowed but returns a boolean instead of throwing.
export function tickerAllowedInChallenge(challenge, ticker, sp500Set) {
  if (!challenge) return true
  const universe = challenge.universe
  const mode = universe?.mode || 'app_all'
  const t = String(ticker || '').toUpperCase()
  if (mode === 'app_all') return true
  if (mode === 'sp500_via_spy') return !!sp500Set?.has(t)
  const list = (universe?.tickers || []).map(s => String(s).toUpperCase())
  if (mode === 'custom_list') return list.includes(t)
  if (mode === 'exclude_list') return !list.includes(t)
  return false
}
