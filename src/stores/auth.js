import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import teachersData from '../mock/teachers.json'
import studentsData from '../mock/students.json'
import groupsData from '../mock/groups.json'

export const useAuthStore = defineStore('auth', () => {
  const students = ref([...studentsData])
  const groups = ref([...groupsData])
  const currentUser = ref(JSON.parse(localStorage.getItem('beatspy_user') || 'null'))
  const isLoggedIn = computed(() => !!currentUser.value)
  const userType = computed(() => currentUser.value?.userType || null)
  const isTeacher = computed(() => userType.value === 'teacher')

  const currentGroup = computed(() => {
    if (!currentUser.value) return null
    return groups.value.find(g => g.id === currentUser.value.groupId) || null
  })

  const groupMembers = computed(() => {
    if (!currentGroup.value) return []
    return students.value.filter(s => currentGroup.value.memberIds.includes(s.id))
  })

  function validateTeacherCode(code) {
    return teachersData.find(t => t.code === code.toUpperCase()) || null
  }

  function getGroupsForCode(code) {
    return groups.value.filter(g => g.teacherCode === code.toUpperCase())
  }

  function signup({ name, email, password, teacherCode, groupId, newGroupName }) {
    const id = 's' + (students.value.length + 1)
    let finalGroupId = groupId

    if (newGroupName) {
      const newGroup = {
        id: 'g' + (groups.value.length + 1),
        name: newGroupName,
        memberIds: [id],
        teacherCode: teacherCode.toUpperCase()
      }
      groups.value.push(newGroup)
      finalGroupId = newGroup.id
    } else {
      const group = groups.value.find(g => g.id === groupId)
      if (group) group.memberIds.push(id)
    }

    const student = { id, name, email, password, groupId: finalGroupId, teacherCode: teacherCode.toUpperCase(), userType: 'student' }
    students.value.push(student)
    currentUser.value = student
    localStorage.setItem('beatspy_user', JSON.stringify(student))
    return student
  }

  function login(email, password) {
    const student = students.value.find(s => s.email === email && s.password === password)
    if (!student) return null
    const userData = { ...student, userType: 'student' }
    currentUser.value = userData
    localStorage.setItem('beatspy_user', JSON.stringify(userData))
    return userData
  }

  function teacherLogin(email, password) {
    const teacher = teachersData.find(t => t.email === email && t.password === password)
    if (!teacher) return null
    const userData = { ...teacher, userType: 'teacher' }
    currentUser.value = userData
    localStorage.setItem('beatspy_user', JSON.stringify(userData))
    return userData
  }

  function logout() {
    currentUser.value = null
    localStorage.removeItem('beatspy_user')
  }

  return {
    currentUser, isLoggedIn, isTeacher, userType, currentGroup, groupMembers, students, groups,
    validateTeacherCode, getGroupsForCode, signup, login, teacherLogin, logout
  }
})
