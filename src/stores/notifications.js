import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref(JSON.parse(localStorage.getItem('beatspy_notifications') || '[]'))

  function save() {
    localStorage.setItem('beatspy_notifications', JSON.stringify(notifications.value))
  }

  function addNotification({ groupId, amount }) {
    notifications.value.push({
      id: 'n' + Date.now(),
      groupId,
      amount,
      seen: false,
      timestamp: Date.now()
    })
    save()
  }

  function getUnseenForGroup(groupId) {
    return notifications.value.filter(n => n.groupId === groupId && !n.seen)
  }

  function markAllSeenForGroup(groupId) {
    notifications.value.forEach(n => {
      if (n.groupId === groupId && !n.seen) n.seen = true
    })
    save()
  }

  return { notifications, addNotification, getUnseenForGroup, markAllSeenForGroup }
})
