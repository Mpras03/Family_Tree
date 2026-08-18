import { defineStore } from 'pinia'
import { ref } from 'vue'
import { request } from '@/lib/http'

export interface Member {
  id: string
  fullName: string
  nickname: string | null
  phonenumber: string | null
  birthDate: string | null
  deathDate: string | null
  gender: 'male' | 'female'
  photoKey: string | null
  bio: string | null
  createdAt: string
  updatedAt: string
}

export interface MemberDetail extends Member {
  parents: string[]
  children: string[]
  spouses: string[]
}

export interface Relationship {
  id: string
  memberId: string
  relatedMemberId: string
  type: 'parent' | 'spouse'
  createdAt: string
}

export const useMembersStore = defineStore('members', () => {
  const members = ref<Member[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMembers() {
    loading.value = true
    error.value = null
    try {
      members.value = await request<Member[]>('/api/members')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load members'
    } finally {
      loading.value = false
    }
  }

  function fetchMember(id: string) {
    return request<MemberDetail>(`/api/members/${id}`)
  }

  async function createMember(payload: Record<string, unknown>) {
    const created = await request<Member>('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    members.value.push(created)
    return created
  }

  async function updateMember(id: string, payload: Record<string, unknown>) {
    const updated = await request<Member>(`/api/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const idx = members.value.findIndex((m) => m.id === id)
    if (idx !== -1) members.value[idx] = updated
    return updated
  }

  async function deleteMember(id: string) {
    await request<void>(`/api/members/${id}`, { method: 'DELETE' })
    members.value = members.value.filter((m) => m.id !== id)
  }

  function addRelationship(payload: { memberId: string; relatedMemberId: string; type: 'parent' | 'spouse' }) {
    return request<Relationship>('/api/relationships', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }

  function removeRelationship(id: string) {
    return request<void>(`/api/relationships/${id}`, { method: 'DELETE' })
  }

  async function uploadPhoto(file: File) {
    const form = new FormData()
    form.append('file', file)
    return request<{ key: string }>('/api/photos', { method: 'POST', body: form })
  }

  return {
    members,
    loading,
    error,
    fetchMembers,
    fetchMember,
    createMember,
    updateMember,
    deleteMember,
    addRelationship,
    removeRelationship,
    uploadPhoto,
  }
})
