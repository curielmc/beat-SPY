import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'
import { useMarketDataStore } from './marketData'

export const useTeacherStore = defineStore('teacher', () => {
  const auth = useAuthStore()

  const classes = ref([])
  const groups = ref([])
  const students = ref([])
  const unassignedStudents = ref([])
  const loading = ref(false)

  function buildGroupFallback(group) {
    const members = students.value.filter(s => s.group_id === group.id)
    return {
      ...group,
      totalValue: 0,
      returnPct: 0,
      benchmarkReturnPct: 0,
      isBeatingSP500: false,
      cash: 0,
      startingCash: 0,
      lastTradeAt: null,
      fundCount: 0,
      funds: [],
      members,
      memberNames: members.map(m => m.name).filter(Boolean)
    }
  }

  // Load all teacher data
  async function loadTeacherData() {
    if (!auth.currentUser) return
    loading.value = true
    try {
      // Fetch all classes (any teacher can manage any class)
      const { data: classData } = await supabase
        .from('classes')
        .select('*')
      classes.value = classData || []

      if (classes.value.length === 0) {
        groups.value = []
        students.value = []
        unassignedStudents.value = []
        return
      }

      const classIds = classes.value.map(c => c.id)

      // Fetch groups for all classes
      const { data: groupData } = await supabase
        .from('groups')
        .select('*')
        .in('class_id', classIds)
      groups.value = groupData || []

      // Fetch all memberships with profile info
      const { data: memberData } = await supabase
        .from('class_memberships')
        .select('*, profiles:profiles(id, full_name, email, avatar_url)')
        .in('class_id', classIds)

      students.value = (memberData || []).map(m => ({
        ...m,
        name: m.profiles?.full_name,
        email: m.profiles?.email,
        userId: m.user_id
      }))

      unassignedStudents.value = students.value.filter(s => !s.group_id)
    } finally {
      loading.value = false
    }
  }

  // Get ranked groups with portfolio data
  async function getRankedGroups(classId = null) {
    const market = useMarketDataStore()
    const scopedGroups = classId
      ? groups.value.filter(group => group.class_id === classId)
      : groups.value

    if (!scopedGroups.length) return []

    try {
      const ranked = []
      const groupIds = scopedGroups.map(g => g.id)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Not authenticated')
      }

      const dashboardRes = await fetch('/api/teacher-dashboard-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ group_ids: groupIds, class_id: classId })
      })

      const dashboardData = await dashboardRes.json().catch(() => ({}))
      if (!dashboardRes.ok) {
        throw new Error(dashboardData.error || 'Failed to load teacher dashboard data')
      }

      const groupPortfoliosData = dashboardData.portfolios || []
      const userPortfoliosData = dashboardData.user_portfolios || []
      const membershipData = dashboardData.memberships || []
      const allPortfolios = [...groupPortfoliosData, ...userPortfoliosData]

      if (allPortfolios.length === 0) {
        return scopedGroups
          .map(group => buildGroupFallback(group))
          .sort((a, b) => b.returnPct - a.returnPct)
      }

      const portfolioIds = allPortfolios.map(p => p.id)
      const allHoldings = dashboardData.holdings || []
      const allTrades = dashboardData.trades || []

      // Collect all unique tickers for current quotes
      const allTickers = [...new Set([
        ...allHoldings.map(h => h.ticker).filter(Boolean),
        ...allPortfolios.map(p => p.benchmark_ticker || 'SPY'),
        'SPY'
      ])]

      // Collect all historical benchmark price requirements
      const benchmarkNeeds = {} // { ticker: Set(dates) }
      for (const p of allPortfolios) {
        const bt = p.benchmark_ticker || 'SPY'
        const createdAt = p.created_at || new Date().toISOString()
        const date = createdAt.includes('T') ? createdAt.split('T')[0] : createdAt
        if (!benchmarkNeeds[bt]) benchmarkNeeds[bt] = new Set()
        if (date) benchmarkNeeds[bt].add(date)
      }

      // Parallelize market data fetches
      try {
        const marketCalls = [
          market.fetchBatchQuotes(allTickers),
          market.fetchBatchProfiles(allTickers)
        ]

        for (const [bt, dates] of Object.entries(benchmarkNeeds)) {
          for (const date of dates) {
            marketCalls.push(market.fetchHistoricalCloseForTickers([bt], date))
          }
        }
        await Promise.all(marketCalls)
      } catch (err) {
        console.warn('Market data batch fetch error:', err)
      }

      const enrichedHoldingsByPort = {}
      for (const h of allHoldings) {
        const currentPrice = market.getCachedPrice(h.ticker) || h.avg_cost
        const marketValue = Number(h.shares || 0) * Number(currentPrice || 0)
        const costBasis = Number(h.shares || 0) * Number(h.avg_cost || 0)
        const profile = market.profilesCache[h.ticker]?.data
        const gainLoss = marketValue - costBasis
        const gainLossPct = costBasis > 0 ? (gainLoss / costBasis) * 100 : 0

        const enrichedHolding = {
          ...h,
          companyName: profile?.companyName || h.ticker,
          sector: profile?.sector || '',
          currentPrice,
          marketValue,
          gainLoss,
          gainLossPct
        }

        if (!enrichedHoldingsByPort[h.portfolio_id]) enrichedHoldingsByPort[h.portfolio_id] = []
        enrichedHoldingsByPort[h.portfolio_id].push(enrichedHolding)
      }

      const tradesByPort = {}
      for (const t of allTrades) {
        if (!tradesByPort[t.portfolio_id]) tradesByPort[t.portfolio_id] = []
        tradesByPort[t.portfolio_id].push(t)
      }

      const userPortfoliosByOwner = {}
      for (const portfolio of userPortfoliosData) {
        if (!userPortfoliosByOwner[portfolio.owner_id]) userPortfoliosByOwner[portfolio.owner_id] = []
        userPortfoliosByOwner[portfolio.owner_id].push(portfolio)
      }

      // Build the results
      for (const group of scopedGroups) {
        const ownedGroupPortfolios = groupPortfoliosData.filter(p => p.owner_id === group.id)
        const memberUserPortfolios = membershipData
          .filter(membership => membership.group_id === group.id)
          .flatMap(membership => userPortfoliosByOwner[membership.user_id] || [])

        const groupPortfolios = ownedGroupPortfolios.length ? ownedGroupPortfolios : memberUserPortfolios

        let funds = []
        let groupTotalValue = 0
        let groupStartingCash = 0
        let groupCash = 0
        let lastTradeAt = null

        if (groupPortfolios.length) {
          funds = groupPortfolios.map(portfolio => {
            const holdings = (enrichedHoldingsByPort[portfolio.id] || []).sort((a, b) => b.marketValue - a.marketValue)
            const investedValue = holdings.reduce((sum, h) => sum + h.marketValue, 0)
            const fundCash = Number(portfolio.cash_balance || 0)
            const fundStartingCash = Number(portfolio.fund_starting_cash || portfolio.starting_cash || 100000)
            const fundTotalValue = investedValue + fundCash
            const fundReturnPct = fundStartingCash > 0 ? ((fundTotalValue - fundStartingCash) / fundStartingCash) * 100 : 0

            // Benchmark comparison
            const bt = portfolio.benchmark_ticker || 'SPY'
            const createdAt = portfolio.created_at || new Date().toISOString()
            const benchmarkDate = createdAt.includes('T') ? createdAt.split('T')[0] : createdAt
            const currentBenchmarkPrice = market.getCachedPrice(bt)
            const startBenchmarkPrice = market.historicalPricesCache[`${bt}:${benchmarkDate}`]
            let benchmarkReturnPct = 0
            if (currentBenchmarkPrice && startBenchmarkPrice) {
              benchmarkReturnPct = ((currentBenchmarkPrice - startBenchmarkPrice) / startBenchmarkPrice) * 100
            }

            groupTotalValue += fundTotalValue
            groupStartingCash += fundStartingCash
            groupCash += fundCash

            const fundLastTrade = tradesByPort[portfolio.id]?.[0]?.executed_at
            if (fundLastTrade && (!lastTradeAt || fundLastTrade > lastTradeAt)) lastTradeAt = fundLastTrade

            return {
              ...portfolio,
              holdings,
              investedValue,
              totalValue: fundTotalValue,
              returnPct: fundReturnPct,
              benchmarkReturnPct,
              isBeatingSP500: fundReturnPct > benchmarkReturnPct,
              positionsCount: holdings.length
            }
          }).sort((a, b) => (a.fund_number || 1) - (b.fund_number || 1))
        } else {
          groupTotalValue = 0
          groupStartingCash = 0
          groupCash = 0
        }

        const returnPct = groupStartingCash > 0 ? ((groupTotalValue - groupStartingCash) / groupStartingCash) * 100 : 0

        // Aggregate benchmark performance across all funds
        const aggregateBenchmarkValue = funds.reduce((sum, fund) => {
          const fundStartingCash = Number(fund.starting_cash || fund.fund_starting_cash || 100000)
          return sum + (fundStartingCash * (1 + (fund.benchmarkReturnPct / 100)))
        }, 0)
        const groupBenchmarkReturnPct = groupStartingCash > 0 ? ((aggregateBenchmarkValue - groupStartingCash) / groupStartingCash) * 100 : 0

        const members = students.value.filter(s => s.group_id === group.id)

        ranked.push({
          ...group,
          totalValue: groupTotalValue,
          returnPct,
          benchmarkReturnPct: groupBenchmarkReturnPct || 0,
          isBeatingSP500: returnPct > groupBenchmarkReturnPct,
          cash: groupCash,
          startingCash: groupStartingCash,
          lastTradeAt,
          fundCount: groupPortfolios.length,
          funds,
          members,
          memberNames: members.map(m => m.name).filter(Boolean)
        })
      }

      return ranked.sort((a, b) => b.returnPct - a.returnPct)
    } catch (err) {
      console.error('Failed to rank teacher groups:', err)
      return scopedGroups
        .map(group => buildGroupFallback(group))
        .sort((a, b) => b.returnPct - a.returnPct)
    }
  }

  // Create a new class
  async function createClass({ code, className, school, groupMode, startingCash, allowReset, maxPortfolios }) {
    if (!auth.currentUser) return { error: 'Not logged in' }

    const { data, error } = await supabase
      .from('classes')
      .insert({
        teacher_id: auth.currentUser.id,
        code: code.toUpperCase(),
        class_name: className,
        school,
        group_mode: groupMode || 'student_choice',
        starting_cash: startingCash || 100000,
        allow_reset: allowReset || false,
        max_portfolios: maxPortfolios || 1
      })
      .select()
      .single()

    if (error) return { error: error.message }
    classes.value.push(data)
    return { class: data }
  }

  // Generate a class code
  function generateClassCode(className) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const prefix = (className || 'CLS').replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase() || 'CLS'
    let suffix = ''
    for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
    return prefix + '-' + suffix
  }

  // Create a group
  async function createGroup(classId, groupName) {
    const { data, error } = await supabase
      .from('groups')
      .insert({ class_id: classId, name: groupName })
      .select()
      .single()

    if (error) return { error: error.message }
    groups.value.push(data)

    // Use class starting_cash
    const cls = classes.value.find(c => c.id === classId)
    const cash = cls?.starting_cash || 100000
    const allowReset = cls?.allow_reset || false

    await supabase.from('portfolios').insert({
      owner_type: 'group',
      owner_id: data.id,
      starting_cash: cash,
      cash_balance: cash,
      allow_reset: allowReset
    })

    return { group: data }
  }

  // Update class settings (starting_cash, allow_reset, max_portfolios)
  async function updateClassSettings(classId, settings) {
    const { error } = await supabase
      .from('classes')
      .update(settings)
      .eq('id', classId)

    if (error) return { error: error.message }
    const cls = classes.value.find(c => c.id === classId)
    if (cls) Object.assign(cls, settings)
    return { success: true }
  }

  // Assign student to group
  async function assignStudentToGroup(membershipId, groupId) {
    const { error } = await supabase
      .from('class_memberships')
      .update({ group_id: groupId })
      .eq('id', membershipId)

    if (error) return { error: error.message }
    await loadTeacherData()
    return { success: true }
  }

  // Move student between groups
  async function moveStudentToGroup(membershipId, toGroupId) {
    const { error } = await supabase
      .from('class_memberships')
      .update({ group_id: toGroupId })
      .eq('id', membershipId)

    if (error) return { error: error.message }
    await loadTeacherData()
    return { success: true }
  }

  // Kick from group (set group_id to null)
  async function kickFromGroup(membershipId) {
    const { error } = await supabase
      .from('class_memberships')
      .update({ group_id: null })
      .eq('id', membershipId)

    if (error) return { error: error.message }
    await loadTeacherData()
    return { success: true }
  }

  // Kick student permanently (remove membership + block email)
  async function kickStudent(membershipId, classId, email) {
    // Delete the membership
    await supabase
      .from('class_memberships')
      .delete()
      .eq('id', membershipId)

    // Block the email
    if (email) {
      await supabase
        .from('blocked_emails')
        .insert({ class_id: classId, email: email.toLowerCase() })
    }

    await loadTeacherData()
    return { success: true }
  }

  // Award or deduct cash (pass negative amount to deduct)
  async function awardBonusCash(groupId, amount) {
    // Get portfolio for this group
    const { data: pData } = await supabase
      .from('portfolios')
      .select('id, cash_balance, starting_cash')
      .eq('owner_type', 'group')
      .eq('owner_id', groupId)
      .maybeSingle()

    if (pData) {
      // Update both cash_balance AND starting_cash so deposits/withdrawals
      // don't inflate or deflate return calculations
      await supabase
        .from('portfolios')
        .update({
          cash_balance: pData.cash_balance + amount,
          starting_cash: (pData.starting_cash || 100000) + amount
        })
        .eq('id', pData.id)
    } else {
      // Create portfolio if it doesn't exist
      await supabase.from('portfolios').insert({
        owner_type: 'group',
        owner_id: groupId,
        starting_cash: 100000,
        cash_balance: 100000 + amount
      })
    }

    // Add notification
    await supabase.from('notifications').insert({
      group_id: groupId,
      amount
    })

    return { success: true }
  }

  // Update restrictions for a class
  async function updateRestrictions(classId, restrictions) {
    const { error } = await supabase
      .from('classes')
      .update({ restrictions })
      .eq('id', classId)

    if (error) return { error: error.message }
    const cls = classes.value.find(c => c.id === classId)
    if (cls) cls.restrictions = restrictions
    return { success: true }
  }

  // Update group mode
  async function updateGroupMode(classId, mode) {
    const { error } = await supabase
      .from('classes')
      .update({ group_mode: mode })
      .eq('id', classId)

    if (error) return { error: error.message }
    const cls = classes.value.find(c => c.id === classId)
    if (cls) cls.group_mode = mode
    return { success: true }
  }

  // Set trade approval code
  async function setApprovalCode(classId, code) {
    const { error } = await supabase
      .from('classes')
      .update({ approval_code: code || null })
      .eq('id', classId)

    if (error) return { error: error.message }
    const cls = classes.value.find(c => c.id === classId)
    if (cls) cls.approval_code = code || null
    return { success: true }
  }

  // Generate approval code
  function generateApprovalCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  // Get holdings for a specific group (for teacher view)
  async function getGroupHoldings(groupId) {
    const { data: pData } = await supabase
      .from('portfolios')
      .select('id')
      .eq('owner_type', 'group')
      .eq('owner_id', groupId)
      .maybeSingle()

    if (!pData) return []

    const { data: hData } = await supabase
      .from('holdings')
      .select('*')
      .eq('portfolio_id', pData.id)

    const market = useMarketDataStore()
    const tickers = (hData || []).map(h => h.ticker)
    if (tickers.length > 0) {
      await Promise.all([
        market.fetchBatchQuotes(tickers),
        market.fetchBatchProfiles(tickers)
      ])
    }

    return (hData || []).map(h => {
      const currentPrice = market.getCachedPrice(h.ticker) || h.avg_cost
      const marketValue = h.shares * currentPrice
      const costBasis = h.shares * h.avg_cost
      const profile = market.profilesCache[h.ticker]?.data
      return {
        ...h,
        companyName: profile?.companyName || h.ticker,
        sector: profile?.sector || '',
        currentPrice,
        marketValue,
        gainLoss: marketValue - costBasis
      }
    })
  }

  // Load invites for a class
  async function loadInvites(classId) {
    const { data, error } = await supabase
      .from('class_invites')
      .select('*')
      .eq('class_id', classId)
      .order('invited_at', { ascending: false })
    if (error) return []
    return data || []
  }

  // Bulk upsert invites for a class, auto-create groups if group_name provided
  async function addInvites(classId, rows) {
    // Refresh groups to ensure we have current data
    const { data: freshGroups } = await supabase
      .from('groups')
      .select('*')
      .eq('class_id', classId)
    const existingGroups = freshGroups || []

    // Auto-create groups from unique group names
    const groupNames = [...new Set(rows.map(r => r.group_name).filter(Boolean))]
    for (const gName of groupNames) {
      const existing = existingGroups.find(g => g.name.toLowerCase() === gName.toLowerCase())
      if (!existing) {
        await createGroup(classId, gName)
      }
    }

    const invites = rows.map(r => {
      const inv = {
        class_id: classId,
        full_name: r.full_name.trim()
      }
      if (r.email) inv.email = r.email.toLowerCase().trim()
      if (r.grade) inv.grade = r.grade.trim()
      if (r.group_name) inv.group_name = r.group_name.trim()
      return inv
    })
    // Insert rows one by one, skip duplicates
    let added = 0
    for (const inv of invites) {
      const { error: insertErr } = await supabase
        .from('class_invites')
        .insert(inv)
      if (!insertErr) added++
    }

    // Auto-assign existing class members to their group based on email match
    const { data: allGroups } = await supabase
      .from('groups')
      .select('id, name')
      .eq('class_id', classId)
    const { data: memberships } = await supabase
      .from('class_memberships')
      .select('id, user_id, group_id, profiles:profiles(email)')
      .eq('class_id', classId)

    let assigned = 0
    for (const row of rows) {
      if (!row.email || !row.group_name) continue
      const group = (allGroups || []).find(g => g.name.toLowerCase() === row.group_name.toLowerCase())
      if (!group) continue
      const member = (memberships || []).find(m =>
        m.profiles?.email?.toLowerCase() === row.email.toLowerCase().trim()
      )
      if (!member || member.group_id === group.id) continue
      await supabase
        .from('class_memberships')
        .update({ group_id: group.id })
        .eq('id', member.id)
      assigned++
    }

    await loadTeacherData()
    return { data: { added, assigned } }
  }

  // Remove a pending invite
  async function removeInvite(inviteId) {
    const { error } = await supabase
      .from('class_invites')
      .delete()
      .eq('id', inviteId)
    if (error) return { error: error.message }
    return { success: true }
  }

  return {
    classes, groups, students, unassignedStudents, loading,
    loadTeacherData, getRankedGroups, createClass, generateClassCode,
    createGroup, assignStudentToGroup, moveStudentToGroup,
    kickFromGroup, kickStudent, awardBonusCash,
    updateRestrictions, updateGroupMode, setApprovalCode,
    generateApprovalCode, getGroupHoldings, updateClassSettings,
    loadInvites, addInvites, removeInvite
  }
})
