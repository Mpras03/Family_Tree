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

type RelKind = 'parent' | 'child' | 'spouse'

function relIdFor(kind: RelKind, otherId: string): string | undefined {
  const rels = member.value?.relations ?? []
  if (kind === 'parent') {
    return rels.find((r) => r.type === 'parent' && r.memberId === otherId && r.relatedMemberId === id.value)?.id
  }
  if (kind === 'child') {
    return rels.find((r) => r.type === 'parent' && r.memberId === id.value && r.relatedMemberId === otherId)?.id
  }
  return rels.find(
    (r) =>
      r.type === 'spouse' &&
      ((r.memberId === id.value && r.relatedMemberId === otherId) ||
        (r.memberId === otherId && r.relatedMemberId === id.value)),
  )?.id
}

async function removeRelationship(kind: RelKind, otherId: string) {
  const relId = relIdFor(kind, otherId)
  if (!relId) return
  if (!confirm(`Remove relationship with ${nameOf(otherId)}?`)) return
  errorMsg.value = null
  try {
    await store.removeRelationship(relId)
    await load()
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to remove relationship'
  }
}

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
        <li v-for="p in member.parents" :key="p">
          <span>{{ nameOf(p) }}</span>
          <button
            v-if="auth.isAdmin"
            type="button"
            class="btn btn-secondary btn-remove"
            @click="removeRelationship('parent', p)"
          >
            Remove
          </button>
        </li>
      </ul>
      <h2>Children</h2>
      <ul>
        <li v-for="c in member.children" :key="c">
          <span>{{ nameOf(c) }}</span>
          <button
            v-if="auth.isAdmin"
            type="button"
            class="btn btn-secondary btn-remove"
            @click="removeRelationship('child', c)"
          >
            Remove
          </button>
        </li>
      </ul>
      <h2>Spouses</h2>
      <ul>
        <li v-for="s in member.spouses" :key="s">
          <span>{{ nameOf(s) }}</span>
          <button
            v-if="auth.isAdmin"
            type="button"
            class="btn btn-secondary btn-remove"
            @click="removeRelationship('spouse', s)"
          >
            Remove
          </button>
        </li>
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

.relations-card li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1) 0;
  max-width: 22rem;
}

.btn-remove {
  padding: var(--space-1) var(--space-2);
  font-size: 0.8rem;
  font-weight: 500;
}

.add-relationship {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
  align-items: center;
}
</style>
