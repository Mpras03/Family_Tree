<script setup lang="ts">
import { onMounted } from 'vue'
import { useMembersStore } from '@/stores/members'
import { useAuthStore } from '@/stores/auth'

const store = useMembersStore()
const auth = useAuthStore()
onMounted(() => store.fetchMembers())
</script>

<template>
  <div class="page">
    <div class="header">
      <h1>Family Members</h1>
      <RouterLink v-if="auth.isAdmin" to="/members/new" class="btn btn-primary">+ Add member</RouterLink>
    </div>

    <p v-if="store.loading" class="text-muted">Loading...</p>
    <p v-else-if="store.error" class="error-text">{{ store.error }}</p>
    <p v-else-if="store.members.length === 0" class="text-muted">No members yet.</p>
    <ul v-else class="member-list card">
      <li v-for="member in store.members" :key="member.id">
        <RouterLink :to="`/members/${member.id}`">
          {{ member.fullName }}
          <span v-if="member.nickname" class="text-muted">({{ member.nickname }})</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.member-list {
  list-style: none;
  padding: var(--space-2);
  margin: 0;
}

.member-list li {
  padding: 0;
  border-bottom: 1px solid var(--color-border);
}

.member-list li:last-child {
  border-bottom: none;
}

.member-list a {
  display: block;
  padding: var(--space-3);
  text-decoration: none;
  border-radius: var(--radius-sm);
}

.member-list a:hover {
  background: var(--color-bg);
}
</style>
