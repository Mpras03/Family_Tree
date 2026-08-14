<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMembersStore, type MemberDetail } from '@/stores/members'

const route = useRoute()
const store = useMembersStore()

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
  <div v-if="member">
    <h1>{{ member.fullName }}</h1>
    <p v-if="member.nickname">"{{ member.nickname }}"</p>
    <p>Gender: {{ member.gender }}</p>
    <p v-if="member.birthDate">Born: {{ member.birthDate }}</p>
    <p v-if="member.deathDate">Died: {{ member.deathDate }}</p>
    <p v-if="member.bio">{{ member.bio }}</p>

    <RouterLink :to="`/members/${member.id}/edit`">Edit</RouterLink>

    <section>
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

    <section>
      <h2>Add relationship</h2>
      <select v-model="relType">
        <option value="parent">Parent of...</option>
        <option value="child">Child of...</option>
        <option value="spouse">Spouse of...</option>
      </select>
      <select v-model="relatedId">
        <option value="" disabled>Select member</option>
        <option v-for="m in otherMembers" :key="m.id" :value="m.id">{{ m.fullName }}</option>
      </select>
      <button @click="addRelationship">Add</button>
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </section>
  </div>
</template>

<style scoped>
.error {
  color: #c0392b;
}
</style>
