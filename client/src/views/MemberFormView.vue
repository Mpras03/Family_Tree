<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMembersStore, type MemberDetail } from '@/stores/members'
import MemberPickerModal from '@/components/MemberPickerModal.vue'

const route = useRoute()
const router = useRouter()
const store = useMembersStore()

const id = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => !!id.value)
const backTo = computed(() => (isEdit.value ? `/members/${id.value}` : '/members'))

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

type RelType = 'parent' | 'child' | 'spouse'
interface RelDraft {
  type: RelType
  relatedId: string
}
const relDrafts = ref<RelDraft[]>([])
const relErrors = ref<string[]>([])
const createdId = ref<string | null>(null)

const relTypeLabels: Record<RelType, string> = {
  parent: 'Parent of...',
  child: 'Child of...',
  spouse: 'Spouse of...',
}

const detailed = ref<MemberDetail[]>([])
const pickerIndex = ref<number | null>(null)

function nameOf(memberId: string) {
  return store.members.find((m) => m.id === memberId)?.fullName ?? memberId
}

const memberOptions = computed(() =>
  detailed.value
    .filter((m) => m.id !== id.value)
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      parents: m.parents.map(nameOf).join(', ') || '—',
    })),
)

function selectedName(relatedId: string) {
  return memberOptions.value.find((o) => o.id === relatedId)?.fullName ?? ''
}

onMounted(async () => {
  if (store.members.length === 0) await store.fetchMembers()

  if (!isEdit.value) {
    try {
      detailed.value = await Promise.all(store.members.map((m) => store.fetchMember(m.id)))
    } catch {
      detailed.value = store.members.map((m) => ({ ...m, parents: [], children: [], spouses: [], relations: [] }))
    }
  }

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

function addRelDraft() {
  relDrafts.value.push({ type: 'parent', relatedId: '' })
}

function removeRelDraft(index: number) {
  relDrafts.value.splice(index, 1)
}

function openPicker(index: number) {
  pickerIndex.value = index
}

function closePicker() {
  pickerIndex.value = null
}

function pickMember(memberId: string) {
  const draft = pickerIndex.value !== null ? relDrafts.value[pickerIndex.value] : undefined
  if (draft) draft.relatedId = memberId
  closePicker()
}

async function createRelationships(memberId: string) {
  relErrors.value = []
  for (const draft of relDrafts.value) {
    if (!draft.relatedId) continue
    try {
      if (draft.type === 'child') {
        await store.addRelationship({ memberId: draft.relatedId, relatedMemberId: memberId, type: 'parent' })
      } else {
        await store.addRelationship({ memberId, relatedMemberId: draft.relatedId, type: draft.type })
      }
    } catch (e) {
      const name = nameOf(draft.relatedId)
      relErrors.value.push(`${relTypeLabels[draft.type]} ${name}: ${e instanceof Error ? e.message : 'failed'}`)
    }
  }
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
      await createRelationships(created.id)
      if (relErrors.value.length) {
        createdId.value = created.id
        return
      }
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
  <div class="page member-form-page">
    <div class="form-layout">
      <div class="card form-card">
        <div class="form-header">
          <RouterLink v-if="isEdit" :to="backTo" class="btn btn-secondary">&larr; Back</RouterLink>
          <h1>{{ isEdit ? 'Edit Member' : 'Add Member' }}</h1>
        </div>
        <form @submit.prevent="submit">
          <label class="form-field">
            Full name
            <input v-model="form.fullName" class="input" required />
          </label>
          <label class="form-field">
            Nickname
            <input v-model="form.nickname" class="input" />
          </label>
          <label class="form-field">
            Phone number
            <input v-model="form.phonenumber" class="input" />
          </label>
          <label class="form-field">
            Gender
            <select v-model="form.gender" class="input">
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label class="form-field">
            Birth date
            <input v-model="form.birthDate" type="date" class="input" />
          </label>
          <label class="form-field">
            Death date
            <input v-model="form.deathDate" type="date" class="input" />
          </label>
          <label class="form-field">
            Bio
            <textarea v-model="form.bio" class="input" rows="4"></textarea>
          </label>
          <label class="form-field">
            Photo
            <input type="file" accept="image/*" @change="onFileChange" />
          </label>

          <p v-if="errorMsg" class="error-text">{{ errorMsg }}</p>
          <div v-if="relErrors.length" class="rel-errors">
            <p class="error-text">Member saved, but some relationships failed:</p>
            <ul>
              <li v-for="(msg, i) in relErrors" :key="i" class="error-text">{{ msg }}</li>
            </ul>
            <RouterLink v-if="createdId" :to="`/members/${createdId}`" class="btn btn-primary">
              Continue to member
            </RouterLink>
          </div>

          <button v-if="!createdId" type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </form>
      </div>

      <aside v-if="!isEdit" class="card relations-panel">
        <h2>Family relationships <span class="text-muted">(optional)</span></h2>
        <p v-if="memberOptions.length === 0" class="text-muted">
          Add more members first to link relationships.
        </p>
        <template v-else>
          <div v-for="(draft, i) in relDrafts" :key="i" class="rel-row">
            <select v-model="draft.type" class="input">
              <option value="parent">Parent of...</option>
              <option value="child">Child of...</option>
              <option value="spouse">Spouse of...</option>
            </select>
            <button type="button" class="input picker-trigger" @click="openPicker(i)">
              <span :class="{ 'text-muted': !draft.relatedId }">
                {{ draft.relatedId ? selectedName(draft.relatedId) : 'Select member' }}
              </span>
            </button>
            <button type="button" class="btn btn-secondary" @click="removeRelDraft(i)">Remove</button>
          </div>
          <button type="button" class="btn btn-secondary" @click="addRelDraft">+ Add relationship</button>
        </template>
      </aside>
    </div>

    <MemberPickerModal
      v-if="pickerIndex !== null"
      :options="memberOptions"
      @select="pickMember"
      @close="closePicker"
    />
  </div>
</template>

<style scoped>
.member-form-page {
  max-width: 64rem;
}

.form-layout {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}

.form-card {
  flex: 0 0 28rem;
  max-width: 28rem;
}

.relations-panel {
  flex: 1;
  min-width: 16rem;
}

.relations-panel h2 {
  font-size: 1rem;
}

.form-header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.form-header h1 {
  margin: 0;
}

form {
  display: flex;
  flex-direction: column;
}

.rel-row {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
  flex-wrap: wrap;
}

.picker-trigger {
  flex: 1;
  min-width: 8rem;
  text-align: left;
  cursor: pointer;
}

.rel-errors {
  margin-bottom: var(--space-3);
}

.rel-errors ul {
  margin: var(--space-1) 0 var(--space-2);
  padding-left: var(--space-4);
}

@media (max-width: 800px) {
  .form-layout {
    flex-direction: column;
  }

  .form-card {
    flex-basis: auto;
    max-width: 100%;
  }

  .relations-panel {
    width: 100%;
  }
}
</style>
