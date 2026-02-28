import { defineStore } from 'pinia'
import { computed } from 'vue'
import { useAuthStore } from './auth'
import { usePortfolioStore } from './portfolio'
import { useNotificationsStore } from './notifications'

export const useTeacherStore = defineStore('teacher', () => {
  const auth = useAuthStore()

  const currentTeacherData = computed(() => {
    if (!auth.currentUser || auth.currentUser.userType !== 'teacher') return null
    return auth.teachers.find(t => t.id === auth.currentUser.id) || null
  })

  const teacherGroups = computed(() => {
    if (!currentTeacherData.value) return []
    return auth.groups.filter(g => g.teacherCode === currentTeacherData.value.code)
  })

  const teacherStudents = computed(() => {
    if (!currentTeacherData.value) return []
    return auth.students.filter(s => s.teacherCode === currentTeacherData.value.code)
  })

  const unassignedStudents = computed(() => {
    if (!currentTeacherData.value) return []
    return auth.students.filter(s => s.teacherCode === currentTeacherData.value.code && s.groupId === null)
  })

  const rankedGroups = computed(() => {
    const portfolio = usePortfolioStore()
    return [...teacherGroups.value]
      .map(g => ({
        ...g,
        returnPct: portfolio.getPortfolioReturn(g.id),
        totalValue: portfolio.getPortfolioValue(g.id)
      }))
      .sort((a, b) => b.returnPct - a.returnPct)
  })

  function updateRestrictions(restrictions) {
    if (!currentTeacherData.value) return
    const teacher = auth.teachers.find(t => t.id === currentTeacherData.value.id)
    if (teacher) {
      teacher.restrictions = { ...restrictions }
    }
  }

  function updateGroupMode(mode) {
    if (!currentTeacherData.value) return
    const teacher = auth.teachers.find(t => t.id === currentTeacherData.value.id)
    if (teacher) {
      teacher.groupMode = mode
    }
  }

  function createClassCode(code, className) {
    if (!currentTeacherData.value) return null
    const existing = auth.teachers.find(t => t.code === code.toUpperCase())
    if (existing) return null
    const newEntry = {
      id: currentTeacherData.value.id,
      code: code.toUpperCase(),
      teacherName: currentTeacherData.value.teacherName,
      className,
      school: currentTeacherData.value.school,
      email: currentTeacherData.value.email,
      password: currentTeacherData.value.password,
      groupMode: currentTeacherData.value.groupMode || 'student_choice',
      tradeApprovalCode: currentTeacherData.value.tradeApprovalCode || null,
      restrictions: { ...currentTeacherData.value.restrictions }
    }
    auth.teachers.push(newEntry)
    return newEntry
  }

  function createGroupForTeacher(groupName) {
    if (!currentTeacherData.value) return null
    const newGroup = {
      id: 'g' + (auth.groups.length + 1),
      name: groupName,
      memberIds: [],
      teacherCode: currentTeacherData.value.code
    }
    auth.groups.push(newGroup)
    return newGroup
  }

  function assignStudentToGroup(studentId, groupId) {
    const student = auth.students.find(s => s.id === studentId)
    if (!student) return
    // Remove from old group if any
    if (student.groupId) {
      const oldGroup = auth.groups.find(g => g.id === student.groupId)
      if (oldGroup) {
        oldGroup.memberIds = oldGroup.memberIds.filter(id => id !== studentId)
      }
    }
    // Add to new group
    student.groupId = groupId
    const newGroup = auth.groups.find(g => g.id === groupId)
    if (newGroup && !newGroup.memberIds.includes(studentId)) {
      newGroup.memberIds.push(studentId)
    }
    // Sync localStorage if this is the current user
    if (auth.currentUser?.id === studentId) {
      auth.currentUser.groupId = groupId
      localStorage.setItem('beatspy_user', JSON.stringify(auth.currentUser))
    }
  }

  function moveStudentToGroup(studentId, fromGroupId, toGroupId) {
    const student = auth.students.find(s => s.id === studentId)
    if (!student) return
    // Remove from old group
    const oldGroup = auth.groups.find(g => g.id === fromGroupId)
    if (oldGroup) {
      oldGroup.memberIds = oldGroup.memberIds.filter(id => id !== studentId)
    }
    // Add to new group
    student.groupId = toGroupId
    const newGroup = auth.groups.find(g => g.id === toGroupId)
    if (newGroup && !newGroup.memberIds.includes(studentId)) {
      newGroup.memberIds.push(studentId)
    }
    // Sync localStorage if this is the current user
    if (auth.currentUser?.id === studentId) {
      auth.currentUser.groupId = toGroupId
      localStorage.setItem('beatspy_user', JSON.stringify(auth.currentUser))
    }
  }

  function awardBonusCash(groupId, amount) {
    const portfolioStore = usePortfolioStore()
    const notificationsStore = useNotificationsStore()
    const p = portfolioStore.portfolios[groupId]
    if (!p) {
      // Create a new portfolio for this group if it doesn't exist
      portfolioStore.portfolios[groupId] = { cashBalance: amount, holdings: [] }
    } else {
      p.cashBalance += amount
    }
    portfolioStore.version++
    notificationsStore.addNotification({ groupId, amount })
  }

  // Trade Approval Code
  function setTradeApprovalCode(code) {
    if (!currentTeacherData.value) return
    const teacher = auth.teachers.find(t => t.id === currentTeacherData.value.id)
    if (teacher) {
      teacher.tradeApprovalCode = code || null
    }
  }

  function generateApprovalCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
    return code
  }

  return {
    currentTeacherData, teacherGroups, teacherStudents, unassignedStudents, rankedGroups,
    updateRestrictions, updateGroupMode, createClassCode,
    createGroupForTeacher, assignStudentToGroup, moveStudentToGroup,
    awardBonusCash, setTradeApprovalCode, generateApprovalCode
  }
})
