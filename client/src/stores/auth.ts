import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { request } from '@/lib/http'

export type Role = 'admin' | 'editor' | 'user'

export interface SessionUser {
  id: string
  username: string
  role: Role
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const isAdmin = computed(() => user.value?.role === 'admin')
  // admin + editor can manage family members and the tree; plain users only see the tree
  const canManageMembers = computed(
    () => user.value?.role === 'admin' || user.value?.role === 'editor',
  )

  async function fetchMe() {
    try {
      user.value = await request<SessionUser>('/api/auth/me')
    } catch {
      user.value = null
    } finally {
      initialized.value = true
    }
  }

  async function login(username: string, password: string) {
    loading.value = true
    error.value = null
    try {
      user.value = await request<SessionUser>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Login failed'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await request<void>('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, initialized, loading, error, isAdmin, canManageMembers, fetchMe, login, logout }
})
