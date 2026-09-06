<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useUsersStore, type Role } from '@/stores/users'
import { useAuthStore } from '@/stores/auth'

const store = useUsersStore()
const auth = useAuthStore()

onMounted(() => store.fetchUsers())

const newUsername = ref('')
const newPassword = ref('')
const newRole = ref<Role>('user')
const createError = ref<string | null>(null)
const creating = ref(false)

const resetPasswordFor = ref<string | null>(null)
const resetPasswordValue = ref('')
const rowError = ref<Record<string, string>>({})

async function createUser() {
  creating.value = true
  createError.value = null
  try {
    await store.createUser({ username: newUsername.value, password: newPassword.value, role: newRole.value })
    newUsername.value = ''
    newPassword.value = ''
    newRole.value = 'user'
  } catch (e) {
    createError.value = e instanceof Error ? e.message : 'Failed to create user'
  } finally {
    creating.value = false
  }
}

async function changeRole(id: string, role: Role) {
  rowError.value[id] = ''
  try {
    await store.updateUser(id, { role })
  } catch (e) {
    rowError.value[id] = e instanceof Error ? e.message : 'Failed to update role'
    await store.fetchUsers()
  }
}

function startResetPassword(id: string) {
  resetPasswordFor.value = id
  resetPasswordValue.value = ''
}

async function submitResetPassword(id: string) {
  rowError.value[id] = ''
  try {
    await store.updateUser(id, { password: resetPasswordValue.value })
    resetPasswordFor.value = null
  } catch (e) {
    rowError.value[id] = e instanceof Error ? e.message : 'Failed to reset password'
  }
}

async function removeUser(id: string) {
  rowError.value[id] = ''
  try {
    await store.deleteUser(id)
  } catch (e) {
    rowError.value[id] = e instanceof Error ? e.message : 'Failed to delete user'
  }
}
</script>

<template>
  <div class="page">
    <h1>Manage Users</h1>

    <section class="card create-card">
      <h2>Add user</h2>
      <form class="create-form" @submit.prevent="createUser">
        <label class="form-field">
          Username
          <input v-model="newUsername" class="input" required />
        </label>
        <label class="form-field">
          Password
          <input v-model="newPassword" type="password" class="input" required />
        </label>
        <label class="form-field">
          Role
          <select v-model="newRole" class="input">
            <option value="user">User</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <button type="submit" class="btn btn-primary" :disabled="creating">
          {{ creating ? 'Creating...' : 'Add user' }}
        </button>
      </form>
      <p v-if="createError" class="error-text">{{ createError }}</p>
    </section>

    <p v-if="store.loading">Loading...</p>
    <p v-else-if="store.error" class="error-text">{{ store.error }}</p>

    <table v-else class="card users-table">
      <thead>
        <tr>
          <th>Username</th>
          <th>Role</th>
          <th>Created</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in store.users" :key="u.id">
          <td>{{ u.username }}</td>
          <td>
            <select
              class="input"
              :value="u.role"
              :disabled="u.id === auth.user?.id"
              @change="changeRole(u.id, ($event.target as HTMLSelectElement).value as Role)"
            >
              <option value="user">User</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </td>
          <td>{{ new Date(u.createdAt).toLocaleDateString() }}</td>
          <td class="actions">
            <button class="btn btn-secondary" @click="startResetPassword(u.id)">Reset password</button>
            <button class="btn btn-danger" :disabled="u.id === auth.user?.id" @click="removeUser(u.id)">
              Delete
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="resetPasswordFor" class="card reset-card">
      <h3>Reset password</h3>
      <label class="form-field">
        New password
        <input v-model="resetPasswordValue" type="password" class="input" required />
      </label>
      <div class="actions">
        <button class="btn btn-primary" @click="submitResetPassword(resetPasswordFor)">Save</button>
        <button class="btn btn-secondary" @click="resetPasswordFor = null">Cancel</button>
      </div>
    </div>

    <p v-for="(msg, id) in rowError" :key="id" class="error-text">{{ msg }}</p>
  </div>
</template>

<style scoped>
.create-card {
  margin-bottom: var(--space-5);
}

.create-form {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
  flex-wrap: wrap;
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table th,
.users-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.reset-card {
  margin-top: var(--space-4);
  max-width: 20rem;
}
</style>
