import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useAuthStore } from './auth'

export const useBasketsStore = defineStore('baskets', () => {
  const auth = useAuthStore()
  const myBaskets = ref([])
  const loading = ref(false)

  async function loadMyBaskets() {
    if (!auth.currentUser) return
    loading.value = true
    const { data } = await supabase
      .from('custom_baskets')
      .select('*')
      .eq('user_id', auth.currentUser.id)
      .order('created_at', { ascending: false })
    myBaskets.value = data || []
    loading.value = false
  }

  async function createBasket({ name, description, tickers, isPublic }) {
    if (!auth.currentUser) return { error: 'Not logged in' }
    const { data, error } = await supabase
      .from('custom_baskets')
      .insert({
        user_id: auth.currentUser.id,
        name,
        description: description || null,
        tickers,
        is_public: isPublic || false
      })
      .select()
      .single()
    if (error) return { error: error.message }
    myBaskets.value.unshift(data)
    return { success: true, basket: data }
  }

  async function updateBasket(id, updates) {
    const { data, error } = await supabase
      .from('custom_baskets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: error.message }
    const idx = myBaskets.value.findIndex(b => b.id === id)
    if (idx !== -1) myBaskets.value[idx] = data
    return { success: true, basket: data }
  }

  async function deleteBasket(id) {
    const { error } = await supabase
      .from('custom_baskets')
      .delete()
      .eq('id', id)
    if (error) return { error: error.message }
    myBaskets.value = myBaskets.value.filter(b => b.id !== id)
    return { success: true }
  }

  async function fetchPublicBaskets(userId) {
    const { data } = await supabase
      .from('custom_baskets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
    return data || []
  }

  return {
    myBaskets, loading,
    loadMyBaskets, createBasket, updateBasket, deleteBasket, fetchPublicBaskets
  }
})
