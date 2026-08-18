import { defineStore } from 'pinia'
import { ref } from 'vue'
import { request } from '@/lib/http'

export interface AppUser {
  id: string
  username: string
  role: 'admin' | 'user'
  createdAt: string
  updatedAt: string
}

export const useUsersStore = defineStore('users', () => {
  const users = ref<AppUser[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchUsers() {
    loading.value = true
    error.value = null
    try {
      users.value = await request<AppUser[]>('/api/users')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load users'
    } finally {
      loading.value = false
    }
  }

  async function createUser(payload: { username: string; password: string; role: 'admin' | 'user' }) {
    const created = await request<AppUser>('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    users.value.push(created)
    return created
  }

  async function updateUser(id: string, payload: { role?: 'admin' | 'user'; password?: string }) {
    const updated = await request<AppUser>(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const idx = users.value.findIndex((u) => u.id === id)
    if (idx !== -1) users.value[idx] = updated
    return updated
  }

  async function deleteUser(id: string) {
    await request<void>(`/api/users/${id}`, { method: 'DELETE' })
    users.value = users.value.filter((u) => u.id !== id)
  }

  return { users, loading, error, fetchUsers, createUser, updateUser, deleteUser }
})
