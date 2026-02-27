import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import teachersData from '../mock/teachers.json'
import { useAuthStore } from './auth'
import { usePortfolioStore } from './portfolio'

export const useTeacherStore = defineStore('teacher', () => {
  const teachers = ref([...teachersData])
  const auth = useAuthStore()

  const currentTeacherData = computed(() => {
    if (!auth.currentUser || auth.currentUser.userType !== 'teacher') return null
    return teachers.value.find(t => t.id === auth.currentUser.id) || null
  })

  const teacherGroups = computed(() => {
    if (!currentTeacherData.value) return []
    return auth.groups.filter(g => g.teacherCode === currentTeacherData.value.code)
  })

  const teacherStudents = computed(() => {
    if (!currentTeacherData.value) return []
    return auth.students.filter(s => s.teacherCode === currentTeacherData.value.code)
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
    const teacher = teachers.value.find(t => t.id === currentTeacherData.value.id)
    if (teacher) {
      teacher.restrictions = { ...restrictions }
    }
  }

  function createClassCode(code, className) {
    if (!currentTeacherData.value) return null
    const existing = teachers.value.find(t => t.code === code.toUpperCase())
    if (existing) return null
    const newEntry = {
      id: currentTeacherData.value.id,
      code: code.toUpperCase(),
      teacherName: currentTeacherData.value.teacherName,
      className,
      school: currentTeacherData.value.school,
      email: currentTeacherData.value.email,
      password: currentTeacherData.value.password,
      restrictions: { ...currentTeacherData.value.restrictions }
    }
    teachers.value.push(newEntry)
    return newEntry
  }

  return {
    teachers, currentTeacherData, teacherGroups, teacherStudents, rankedGroups,
    updateRestrictions, createClassCode
  }
})
