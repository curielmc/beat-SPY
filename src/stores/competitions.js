import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { useMarketDataStore } from './marketData'

export const useCompetitionsStore = defineStore('competitions', () => {
  const auth = useAuthStore()
  const competitions = ref([])
  const activeCompetition = ref(null)
  const loading = ref(false)

  async function fetchCompetitions(status = null) {
    loading.value = true
    let query = supabase
      .from('competitions')
      .select('*')
      .order('start_date', { ascending: false })
    if (status) query = query.eq('status', status)
    const { data } = await query
    competitions.value = data || []
    loading.value = false
    return competitions.value
  }

  async function fetchCompetition(id) {
    const { data: comp } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', id)
      .single()
    if (!comp) return null

    const { data: entries } = await supabase
      .from('competition_entries')
      .select('*, profiles:profiles(full_name, username, avatar_url)')
      .eq('competition_id', id)
      .order('final_rank', { ascending: true, nullsFirst: false })

    activeCompetition.value = { ...comp, entries: entries || [] }
    return activeCompetition.value
  }

  async function registerForCompetition(competitionId, thesis = null) {
    if (!auth.currentUser) return { error: 'Not logged in' }

    // Get competition details for starting cash
    const { data: comp } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .single()
    if (!comp) return { error: 'Competition not found' }
    if (comp.status !== 'registration') return { error: 'Registration is not open' }

    // Check if thesis is required
    if (comp.rules?.require_thesis && !thesis?.trim()) {
      return { error: 'A thesis is required to enter this competition' }
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from('competition_entries')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('user_id', auth.currentUser.id)
      .maybeSingle()
    if (existing) return { error: 'Already registered' }

    // Create dedicated portfolio
    const { data: portfolio, error: pError } = await supabase
      .from('portfolios')
      .insert({
        owner_type: 'competition',
        owner_id: auth.currentUser.id,
        name: `${comp.name} Portfolio`,
        starting_cash: comp.starting_cash,
        cash_balance: comp.starting_cash,
        benchmark_ticker: comp.benchmark_ticker,
        is_public: comp.is_public,
        allow_reset: false
      })
      .select()
      .single()
    if (pError) return { error: pError.message }

    // Create entry
    const { data: entry, error: eError } = await supabase
      .from('competition_entries')
      .insert({
        competition_id: competitionId,
        user_id: auth.currentUser.id,
        portfolio_id: portfolio.id,
        thesis: thesis?.trim() || null
      })
      .select()
      .single()
    if (eError) return { error: eError.message }

    return { success: true, entry, portfolio }
  }

  async function getCompetitionLeaderboard(competitionId) {
    const { data: entries } = await supabase
      .from('competition_entries')
      .select('*, profiles:profiles(full_name, username, avatar_url)')
      .eq('competition_id', competitionId)

    if (!entries?.length) return []

    const market = useMarketDataStore()
    const portfolioIds = entries.map(e => e.portfolio_id)

    // Fetch all portfolios
    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('*')
      .in('id', portfolioIds)

    // Fetch all holdings
    const { data: allHoldings } = await supabase
      .from('holdings')
      .select('*')
      .in('portfolio_id', portfolioIds)

    // Get all unique tickers and fetch prices
    const tickers = [...new Set((allHoldings || []).map(h => h.ticker))]
    if (tickers.length > 0) await market.fetchBatchQuotes(tickers)

    // Calculate values
    return entries.map(entry => {
      const portfolio = (portfolios || []).find(p => p.id === entry.portfolio_id)
      const holdings = (allHoldings || []).filter(h => h.portfolio_id === entry.portfolio_id)
      const holdingsValue = holdings.reduce((sum, h) => {
        const price = market.getCachedPrice(h.ticker) || h.avg_cost
        return sum + (h.shares * price)
      }, 0)
      const totalValue = holdingsValue + Number(portfolio?.cash_balance || 0)
      const startingCash = Number(portfolio?.starting_cash || 100000)
      const returnPct = ((totalValue - startingCash) / startingCash) * 100

      return {
        ...entry,
        totalValue,
        returnPct: entry.final_return_pct != null ? Number(entry.final_return_pct) : returnPct,
        holdingsCount: holdings.length
      }
    }).sort((a, b) => b.returnPct - a.returnPct)
  }

  function validateTradeAgainstRules(competition, portfolioHoldings, ticker, dollars, side) {
    const rules = competition.rules || {}
    const errors = []

    if (side === 'buy') {
      // Max position % check
      if (rules.max_position_pct) {
        const existingPosition = portfolioHoldings
          .filter(h => h.ticker === ticker)
          .reduce((sum, h) => sum + (h.shares * (h.currentPrice || h.avg_cost)), 0)
        const newTotal = existingPosition + dollars
        const pct = (newTotal / competition.starting_cash) * 100
        if (pct > rules.max_position_pct) {
          errors.push(`Position would exceed ${rules.max_position_pct}% limit (${pct.toFixed(1)}%)`)
        }
      }

      // Restricted tickers
      if (rules.restricted_tickers?.includes(ticker)) {
        errors.push(`${ticker} is restricted in this competition`)
      }

      // Allowed sectors (would need company profile data — checked client-side in view)
    }

    if (side === 'sell') {
      // Min stocks check
      if (rules.min_stocks) {
        const holding = portfolioHoldings.find(h => h.ticker === ticker)
        if (holding) {
          const wouldSellAll = dollars >= (holding.shares * (holding.currentPrice || holding.avg_cost)) - 0.01
          if (wouldSellAll && portfolioHoldings.length <= rules.min_stocks) {
            errors.push(`Must maintain at least ${rules.min_stocks} stocks`)
          }
        }
      }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true, errors: [] }
  }

  // Admin functions
  async function createCompetition(comp) {
    const { data, error } = await supabase
      .from('competitions')
      .insert({ ...comp, created_by: auth.currentUser.id })
      .select()
      .single()
    if (error) return { error: error.message }
    return { success: true, competition: data }
  }

  async function updateCompetition(id, updates) {
    const { data, error } = await supabase
      .from('competitions')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: error.message }
    return { success: true, competition: data }
  }

  async function finalizeCompetition(competitionId) {
    const leaderboard = await getCompetitionLeaderboard(competitionId)

    // Update each entry with final rank and return
    for (let i = 0; i < leaderboard.length; i++) {
      await supabase
        .from('competition_entries')
        .update({ final_rank: i + 1, final_return_pct: leaderboard[i].returnPct })
        .eq('id', leaderboard[i].id)
    }

    // Mark competition as completed
    await updateCompetition(competitionId, { status: 'completed' })

    return { success: true, leaderboard }
  }

  return {
    competitions, activeCompetition, loading,
    fetchCompetitions, fetchCompetition,
    registerForCompetition, getCompetitionLeaderboard,
    validateTradeAgainstRules,
    createCompetition, updateCompetition, finalizeCompetition
  }
})
