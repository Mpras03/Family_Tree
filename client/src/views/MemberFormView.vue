<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMembersStore } from '@/stores/members'

const route = useRoute()
const router = useRouter()
const store = useMembersStore()

const id = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => !!id.value)

const form = ref({
  fullName: '',
  nickname: '',
  phonenumber: '',
  birthDate: '',
  deathDate: '',
  gender: 'male' as 'male' | 'female',
  bio: '',
})
const photoFile = ref<File | null>(null)
const saving = ref(false)
const errorMsg = ref<string | null>(null)

onMounted(async () => {
  if (id.value) {
    const member = await store.fetchMember(id.value)
    form.value = {
      fullName: member.fullName,
      nickname: member.nickname ?? '',
      phonenumber: member.phonenumber ?? '',
      birthDate: member.birthDate ?? '',
      deathDate: member.deathDate ?? '',
      gender: member.gender,
      bio: member.bio ?? '',
    }
  }
})

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  photoFile.value = target.files?.[0] ?? null
}

async function submit() {
  saving.value = true
  errorMsg.value = null
  try {
    const payload: Record<string, unknown> = { ...form.value }

    if (photoFile.value) {
      const uploaded = await store.uploadPhoto(photoFile.value)
      payload.photoKey = uploaded.key
    }

    if (isEdit.value && id.value) {
      await store.updateMember(id.value, payload)
      router.push(`/members/${id.value}`)
    } else {
      const created = await store.createMember(payload)
      router.push(`/members/${created.id}`)
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to save member'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <h1>{{ isEdit ? 'Edit Member' : 'Add Member' }}</h1>
    <form @submit.prevent="submit">
      <label>
        Full name
        <input v-model="form.fullName" required />
      </label>
      <label>
        Nickname
        <input v-model="form.nickname" />
      </label>
      <label>
        Phone number
        <input v-model="form.phonenumber" />
      </label>
      <label>
        Gender
        <select v-model="form.gender">
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </label>
      <label>
        Birth date
        <input v-model="form.birthDate" type="date" />
      </label>
      <label>
        Death date
        <input v-model="form.deathDate" type="date" />
      </label>
      <label>
        Bio
        <textarea v-model="form.bio"></textarea>
      </label>
      <label>
        Photo
        <input type="file" accept="image/*" @change="onFileChange" />
      </label>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      <button type="submit" :disabled="saving">{{ saving ? 'Saving...' : 'Save' }}</button>
    </form>
  </div>
</template>

<style scoped>
form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 28rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.error {
  color: #c0392b;
}
</style>
