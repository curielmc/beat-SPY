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
  async function getRankedGroups() {
    const market = useMarketDataStore()
    const ranked = []

    for (const group of groups.value) {
      const { data: pData } = await supabase
        .from('portfolios')
        .select('*')
        .eq('owner_type', 'group')
        .eq('owner_id', group.id)
        .maybeSingle()

      let totalValue = 100000
      let returnPct = 0
      let cash = 100000

      if (pData) {
        const { data: hData } = await supabase
          .from('holdings')
          .select('*')
          .eq('portfolio_id', pData.id)

        const tickers = (hData || []).map(h => h.ticker)
        if (tickers.length > 0) {
          await market.fetchBatchQuotes(tickers)
        }

        const holdingsValue = (hData || []).reduce((sum, h) => {
          const price = market.getCachedPrice(h.ticker) || h.avg_cost
          return sum + (h.shares * price)
        }, 0)

        totalValue = holdingsValue + pData.cash_balance
        returnPct = ((totalValue - pData.starting_cash) / pData.starting_cash) * 100
        cash = pData.cash_balance
      }

      const members = students.value.filter(s => s.group_id === group.id)

      ranked.push({
        ...group,
        totalValue,
        returnPct,
        cash,
        members,
        memberNames: members.map(m => m.name).filter(Boolean)
      })
    }

    return ranked.sort((a, b) => b.returnPct - a.returnPct)
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

  // Award bonus cash
  async function awardBonusCash(groupId, amount) {
    // Get portfolio for this group
    const { data: pData } = await supabase
      .from('portfolios')
      .select('id, cash_balance')
      .eq('owner_type', 'group')
      .eq('owner_id', groupId)
      .maybeSingle()

    if (pData) {
      await supabase
        .from('portfolios')
        .update({ cash_balance: pData.cash_balance + amount })
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
      await market.fetchBatchQuotes(tickers)
    }

    return (hData || []).map(h => {
      const currentPrice = market.getCachedPrice(h.ticker) || h.avg_cost
      const marketValue = h.shares * currentPrice
      const costBasis = h.shares * h.avg_cost
      return {
        ...h,
        currentPrice,
        marketValue,
        gainLoss: marketValue - costBasis
      }
    })
  }

  return {
    classes, groups, students, unassignedStudents, loading,
    loadTeacherData, getRankedGroups, createClass, generateClassCode,
    createGroup, assignStudentToGroup, moveStudentToGroup,
    kickFromGroup, kickStudent, awardBonusCash,
    updateRestrictions, updateGroupMode, setApprovalCode,
    generateApprovalCode, getGroupHoldings, updateClassSettings
  }
})
