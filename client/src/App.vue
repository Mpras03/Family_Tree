<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

async function logout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <nav v-if="!route.meta.public" class="app-nav">
    <div class="app-nav-links">
      <RouterLink v-if="auth.canManageMembers" to="/members">Members</RouterLink>
      <RouterLink to="/tree">Family Tree</RouterLink>
      <RouterLink v-if="auth.isAdmin" to="/admin/users">Manage Users</RouterLink>
    </div>
    <div class="app-nav-user">
      <span v-if="auth.user" class="text-muted">{{ auth.user.username }}</span>
      <button class="btn btn-secondary" @click="logout">Logout</button>
    </div>
  </nav>
  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-nav-links {
  display: flex;
  gap: var(--space-4);
}

.app-nav-links a {
  text-decoration: none;
  font-weight: 500;
  color: var(--color-text-muted);
}

.app-nav-links a.router-link-active {
  color: var(--color-text);
}

.app-nav-user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-main {
  min-height: calc(100vh - 57px);
}
</style>
