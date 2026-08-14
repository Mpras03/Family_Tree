<script setup lang="ts"></script>

<template>
  <nav class="app-nav">
    <RouterLink to="/">Members</RouterLink>
    <RouterLink to="/tree">Family Tree</RouterLink>
  </nav>
  <main class="app-main">
    <RouterView />
  </main>
</template>

<style scoped>
.app-nav {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #ddd;
}

.app-main {
  padding: 1rem;
}
</style>
