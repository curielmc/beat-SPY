import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import teachersData from '../mock/teachers.json'
import studentsData from '../mock/students.json'
import groupsData from '../mock/groups.json'

export const useAuthStore = defineStore('auth', () => {
  const students = ref([...studentsData])
  const groups = ref([...groupsData])
  const teachers = ref(JSON.parse(JSON.stringify(teachersData)))
  const currentUser = ref(JSON.parse(localStorage.getItem('beatspy_user') || 'null'))
  const isLoggedIn = computed(() => !!currentUser.value)
  const userType = computed(() => currentUser.value?.userType || null)
  const isTeacher = computed(() => userType.value === 'teacher')

  // Temporary Google credential data for signup flows
  const pendingGoogleData = ref(null)

  const currentGroup = computed(() => {
    if (!currentUser.value) return null
    return groups.value.find(g => g.id === currentUser.value.groupId) || null
  })

  const groupMembers = computed(() => {
    if (!currentGroup.value) return []
    return students.value.filter(s => currentGroup.value.memberIds.includes(s.id))
  })

  function validateTeacherCode(code) {
    return teachers.value.find(t => t.code === code.toUpperCase()) || null
  }

  function getGroupsForCode(code) {
    return groups.value.filter(g => g.teacherCode === code.toUpperCase())
  }

  function generateClassCode(className) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const prefix = className.replace(/[^A-Za-z]/g, '').substring(0, 4).toUpperCase() || 'CLS'
    let code
    do {
      let suffix = ''
      for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)]
      code = prefix + '-' + suffix
    } while (teachers.value.some(t => t.code === code))
    return code
  }

  function signup({ name, email, password, teacherCode, groupId, newGroupName }) {
    const id = 's' + (students.value.length + 1)
    const teacher = teachers.value.find(t => t.code === teacherCode.toUpperCase())
    const isTeacherAssign = teacher?.groupMode === 'teacher_assign'
    let finalGroupId = isTeacherAssign ? null : groupId

    if (!isTeacherAssign) {
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
    const teacher = teachers.value.find(t => t.email === email && t.password === password)
    if (!teacher) return null
    const userData = { ...teacher, userType: 'teacher' }
    currentUser.value = userData
    localStorage.setItem('beatspy_user', JSON.stringify(userData))
    return userData
  }

  function teacherSignup({ name, email, password, school, className, groupMode }) {
    const id = 't' + (teachers.value.length + 1)
    const code = generateClassCode(className)
    const teacher = {
      id, code, teacherName: name, className, school, email, password,
      groupMode: groupMode || 'student_choice',
      tradeApprovalCode: null,
      restrictions: { maxStocksPerPortfolio: 10, allowedSectors: [], blockedTickers: [], maxDollarsPerStock: 20000 }
    }
    teachers.value.push(teacher)
    const userData = { ...teacher, userType: 'teacher' }
    currentUser.value = userData
    localStorage.setItem('beatspy_user', JSON.stringify(userData))
    return { ...userData, generatedCode: code }
  }

  function decodeGoogleJwt(credential) {
    try {
      const payload = credential.split('.')[1]
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
      return JSON.parse(decoded)
    } catch { return null }
  }

  function googleLogin(credential) {
    const data = decodeGoogleJwt(credential)
    if (!data) return { status: 'error', error: 'Invalid credential' }

    const { email, name, picture } = data

    // Check existing student
    const student = students.value.find(s => s.email === email)
    if (student) {
      const userData = { ...student, userType: 'student', picture }
      currentUser.value = userData
      localStorage.setItem('beatspy_user', JSON.stringify(userData))
      return { status: 'logged_in', userType: 'student', user: userData }
    }

    // Check existing teacher
    const teacher = teachers.value.find(t => t.email === email)
    if (teacher) {
      const userData = { ...teacher, userType: 'teacher', picture }
      currentUser.value = userData
      localStorage.setItem('beatspy_user', JSON.stringify(userData))
      return { status: 'logged_in', userType: 'teacher', user: userData }
    }

    // No match — need to choose role and complete signup
    pendingGoogleData.value = { email, name, picture }
    return { status: 'new_user', email, name }
  }

  function googleSignupStudent({ teacherCode, groupId, newGroupName }) {
    if (!pendingGoogleData.value) return null
    const { name, email, picture } = pendingGoogleData.value
    const result = signup({ name, email, password: '__google__', teacherCode, groupId, newGroupName })
    result.picture = picture
    pendingGoogleData.value = null
    return result
  }

  function googleSignupTeacher({ school, className }) {
    if (!pendingGoogleData.value) return null
    const { name, email, picture } = pendingGoogleData.value
    const result = teacherSignup({ name, email, password: '__google__', school, className })
    result.picture = picture
    pendingGoogleData.value = null
    return result
  }

  function logout() {
    currentUser.value = null
    pendingGoogleData.value = null
    localStorage.removeItem('beatspy_user')
  }

  return {
    currentUser, isLoggedIn, isTeacher, userType, currentGroup, groupMembers,
    students, groups, teachers, pendingGoogleData,
    validateTeacherCode, getGroupsForCode, signup, login,
    teacherLogin, teacherSignup, googleLogin, googleSignupStudent, googleSignupTeacher, logout
  }
})
