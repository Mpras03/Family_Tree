<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMembersStore, type MemberDetail } from '@/stores/members'
import { useAuthStore } from '@/stores/auth'
import MemberInfo from '@/components/MemberInfo.vue'

const route = useRoute()
const store = useMembersStore()
const auth = useAuthStore()

const id = computed(() => route.params.id as string)
const member = ref<MemberDetail | null>(null)

async function load() {
  member.value = await store.fetchMember(id.value)
  if (store.members.length === 0) await store.fetchMembers()
}

onMounted(load)

function nameOf(memberId: string) {
  return store.members.find((m) => m.id === memberId)?.fullName ?? memberId
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
        <RouterLink v-if="auth.canManageMembers" :to="`/members/${member.id}/edit`" class="btn btn-secondary">
          Edit
        </RouterLink>
      </div>

      <MemberInfo :member="member" :name-of="nameOf" />
    </div>
  </div>
</template>

<style scoped>
.page > .card {
  margin-bottom: var(--space-4);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: var(--space-3);
}
</style>
