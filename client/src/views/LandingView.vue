<script setup lang="ts"></script>

<template>
  <div class="landing">
    <div class="card landing-card">
      <h1>Family Tree</h1>
      <p class="text-muted">Aplikasi untuk mengelola dan menelusuri silsilah keluarga.</p>
      <RouterLink to="/login" class="btn btn-primary">Login</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.landing {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.landing-card {
  text-align: center;
  max-width: 24rem;
  width: 100%;
}

.landing-card p {
  margin: 0 0 var(--space-5);
}
</style>
