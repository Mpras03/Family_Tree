<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMembersStore, type MemberDetail } from '@/stores/members'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const store = useMembersStore()
const auth = useAuthStore()

const id = computed(() => route.params.id as string)
const member = ref<MemberDetail | null>(null)
const relatedId = ref('')
const relType = ref<'parent' | 'child' | 'spouse'>('parent')
const errorMsg = ref<string | null>(null)

async function load() {
  member.value = await store.fetchMember(id.value)
  if (store.members.length === 0) await store.fetchMembers()
}

onMounted(load)

function nameOf(memberId: string) {
  return store.members.find((m) => m.id === memberId)?.fullName ?? memberId
}

const otherMembers = computed(() => store.members.filter((m) => m.id !== id.value))

async function addRelationship() {
  if (!relatedId.value) return
  errorMsg.value = null
  try {
    if (relType.value === 'child') {
      await store.addRelationship({ memberId: relatedId.value, relatedMemberId: id.value, type: 'parent' })
    } else {
      await store.addRelationship({ memberId: id.value, relatedMemberId: relatedId.value, type: relType.value })
    }
    relatedId.value = ''
    await load()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to add relationship'
  }
}
</script>

<template>
  <div v-if="member" class="page">
    <div class="card">
      <div class="header">
        <div>
          <h1>{{ member.fullName }}</h1>
          <p v-if="member.nickname" class="text-muted">"{{ member.nickname }}"</p>
        </div>
        <RouterLink v-if="auth.isAdmin" :to="`/members/${member.id}/edit`" class="btn btn-secondary">Edit</RouterLink>
      </div>

      <p>Gender: {{ member.gender }}</p>
      <p v-if="member.birthDate">Born: {{ member.birthDate }}</p>
      <p v-if="member.deathDate">Died: {{ member.deathDate }}</p>
      <p v-if="member.bio">{{ member.bio }}</p>
    </div>

    <section class="card relations-card">
      <h2>Parents</h2>
      <ul>
        <li v-for="p in member.parents" :key="p">{{ nameOf(p) }}</li>
      </ul>
      <h2>Children</h2>
      <ul>
        <li v-for="c in member.children" :key="c">{{ nameOf(c) }}</li>
      </ul>
      <h2>Spouses</h2>
      <ul>
        <li v-for="s in member.spouses" :key="s">{{ nameOf(s) }}</li>
      </ul>
    </section>

    <section v-if="auth.isAdmin" class="card">
      <h2>Add relationship</h2>
      <div class="add-relationship">
        <select v-model="relType" class="input">
          <option value="parent">Parent of...</option>
          <option value="child">Child of...</option>
          <option value="spouse">Spouse of...</option>
        </select>
        <select v-model="relatedId" class="input">
          <option value="" disabled>Select member</option>
          <option v-for="m in otherMembers" :key="m.id" :value="m.id">{{ m.fullName }}</option>
        </select>
        <button class="btn btn-primary" @click="addRelationship">Add</button>
      </div>
      <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    </section>
  </div>
</template>

<style scoped>
.page > .card,
.page > section {
  margin-bottom: var(--space-4);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.relations-card h2 {
  font-size: 1rem;
  margin-top: var(--space-3);
}

.relations-card h2:first-child {
  margin-top: 0;
}

.relations-card ul {
  margin: 0 0 var(--space-2);
  padding-left: var(--space-4);
}

.add-relationship {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
}
</style>
