<script setup lang="ts">
import { onMounted } from 'vue'
import { useMembersStore } from '@/stores/members'

const store = useMembersStore()
onMounted(() => store.fetchMembers())
</script>

<template>
  <div>
    <div class="header">
      <h1>Family Members</h1>
      <RouterLink to="/members/new">+ Add member</RouterLink>
    </div>

    <p v-if="store.loading">Loading...</p>
    <p v-else-if="store.error">{{ store.error }}</p>
    <p v-else-if="store.members.length === 0">No members yet.</p>
    <ul v-else class="member-list">
      <li v-for="member in store.members" :key="member.id">
        <RouterLink :to="`/members/${member.id}`">
          {{ member.fullName }}
          <span v-if="member.nickname">({{ member.nickname }})</span>
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
}

.member-list {
  list-style: none;
  padding: 0;
}

.member-list li {
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}
</style>
