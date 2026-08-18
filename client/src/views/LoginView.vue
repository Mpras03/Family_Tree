<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const errorMsg = ref<string | null>(null)
const submitting = ref(false)

async function submit() {
  submitting.value = true
  errorMsg.value = null
  try {
    await auth.login(username.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/members'
    router.push(redirect)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login">
    <form class="card login-card" @submit.prevent="submit">
      <h1>Login</h1>
      <label class="form-field">
        Username
        <input v-model="username" class="input" required autofocus />
      </label>
      <label class="form-field">
        Password
        <input v-model="password" type="password" class="input" required />
      </label>
      <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
      <button type="submit" class="btn btn-primary" :disabled="submitting">
        {{ submitting ? 'Signing in...' : 'Login' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.login-card {
  width: 100%;
  max-width: 22rem;
}

.login-card .btn {
  width: 100%;
  margin-top: var(--space-2);
}
</style>
