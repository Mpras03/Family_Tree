<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMembersStore, type MemberDetail } from '@/stores/members'
import MemberPickerModal from '@/components/MemberPickerModal.vue'

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
  birthOrder: '' as number | '',
  bio: '',
})
const photoFile = ref<File | null>(null)
const photoObjectUrl = ref<string | null>(null)
const saving = ref(false)
const errorMsg = ref<string | null>(null)

type RelType = 'parent' | 'child' | 'spouse'
const relTypeLabels: Record<RelType, string> = {
  parent: 'Parent of...',
  child: 'Child of...',
  spouse: 'Spouse of...',
}

// add mode: relationships queued and created once the member exists
interface RelDraft {
  type: RelType
  relatedId: string
}
const relDrafts = ref<RelDraft[]>([])
const relErrors = ref<string[]>([])
const createdId = ref<string | null>(null)

// edit mode: relationships managed live against the API
const currentMember = ref<MemberDetail | null>(null)
const newRelType = ref<RelType>('parent')
const newRelId = ref('')
const relBusy = ref(false)
const relError = ref<string | null>(null)

const pickerIndex = ref<number | 'new' | null>(null)

function nameOf(memberId: string) {
  return store.members.find((m) => m.id === memberId)?.fullName ?? memberId
}

const memberOptions = computed(() =>
  [...store.members]
    .filter((m) => m.id !== id.value)
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      parents: (m.parents ?? []).map(nameOf).join(', ') || '—',
      gender: m.gender,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName)),
)

function selectedName(relatedId: string) {
  return memberOptions.value.find((o) => o.id === relatedId)?.fullName ?? ''
}

const photoPreviewUrl = computed(() => {
  if (photoObjectUrl.value) return photoObjectUrl.value
  if (currentMember.value?.photoKey) return `/api/photos/${currentMember.value.photoKey}`
  return null
})

onMounted(async () => {
  if (store.members.length === 0) await store.fetchMembers()

  if (id.value) {
    const member = await store.fetchMember(id.value)
    currentMember.value = member
    form.value = {
      fullName: member.fullName,
      nickname: member.nickname ?? '',
      phonenumber: member.phonenumber ?? '',
      birthDate: member.birthDate ?? '',
      deathDate: member.deathDate ?? '',
      gender: member.gender,
      birthOrder: member.birthOrder ?? '',
      bio: member.bio ?? '',
    }
  }
})

onBeforeUnmount(() => {
  if (photoObjectUrl.value) URL.revokeObjectURL(photoObjectUrl.value)
})

const MAX_PHOTO_BYTES = 2 * 1024 * 1024 // 2 MB
const photoError = ref<string | null>(null)

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0] ?? null
  photoError.value = null

  if (file && file.size > MAX_PHOTO_BYTES) {
    photoError.value = `Ukuran foto maksimal 2 MB (file ini ${(file.size / 1024 / 1024).toFixed(1)} MB).`
    target.value = ''
    photoFile.value = null
    if (photoObjectUrl.value) {
      URL.revokeObjectURL(photoObjectUrl.value)
      photoObjectUrl.value = null
    }
    return
  }

  photoFile.value = file
  if (photoObjectUrl.value) {
    URL.revokeObjectURL(photoObjectUrl.value)
    photoObjectUrl.value = null
  }
  if (file) photoObjectUrl.value = URL.createObjectURL(file)
}

// --- add-mode relationship drafts -------------------------------------------
function addRelDraft() {
  relDrafts.value.push({ type: 'parent', relatedId: '' })
}

function removeRelDraft(index: number) {
  relDrafts.value.splice(index, 1)
}

function openPicker(target: number | 'new') {
  pickerIndex.value = target
}

function closePicker() {
  pickerIndex.value = null
}

function pickMember(memberId: string) {
  if (pickerIndex.value === 'new') {
    newRelId.value = memberId
  } else if (pickerIndex.value !== null) {
    const draft = relDrafts.value[pickerIndex.value]
    if (draft) draft.relatedId = memberId
  }
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

// --- edit-mode live relationships ------------------------------------------
async function reloadRelations() {
  if (!id.value) return
  currentMember.value = await store.fetchMember(id.value)
  await store.fetchMembers()
}

function relIdFor(kind: RelType, otherId: string): string | undefined {
  const rels = currentMember.value?.relations ?? []
  if (kind === 'parent') {
    return rels.find((r) => r.type === 'parent' && r.memberId === otherId && r.relatedMemberId === id.value)?.id
  }
  if (kind === 'child') {
    return rels.find((r) => r.type === 'parent' && r.memberId === id.value && r.relatedMemberId === otherId)?.id
  }
  return rels.find(
    (r) =>
      r.type === 'spouse' &&
      ((r.memberId === id.value && r.relatedMemberId === otherId) ||
        (r.memberId === otherId && r.relatedMemberId === id.value)),
  )?.id
}

async function removeRel(kind: RelType, otherId: string) {
  const relId = relIdFor(kind, otherId)
  if (!relId) return
  if (!confirm(`Remove relationship with ${nameOf(otherId)}?`)) return
  relError.value = null
  relBusy.value = true
  try {
    await store.removeRelationship(relId)
    await reloadRelations()
  } catch (e) {
    relError.value = e instanceof Error ? e.message : 'Failed to remove relationship'
  } finally {
    relBusy.value = false
  }
}

async function addRel() {
  if (!newRelId.value || !id.value) return
  relError.value = null
  relBusy.value = true
  try {
    if (newRelType.value === 'child') {
      await store.addRelationship({ memberId: newRelId.value, relatedMemberId: id.value, type: 'parent' })
    } else {
      await store.addRelationship({ memberId: id.value, relatedMemberId: newRelId.value, type: newRelType.value })
    }
    newRelId.value = ''
    await reloadRelations()
  } catch (e) {
    relError.value = e instanceof Error ? e.message : 'Failed to add relationship'
  } finally {
    relBusy.value = false
  }
}

async function submit() {
  if (photoError.value) {
    errorMsg.value = photoError.value
    return
  }
  saving.value = true
  errorMsg.value = null
  try {
    const payload: Record<string, unknown> = {
      ...form.value,
      birthOrder: form.value.birthOrder === '' ? null : Number(form.value.birthOrder),
    }

    if (photoFile.value && photoFile.value.size > MAX_PHOTO_BYTES) {
      throw new Error('Ukuran foto maksimal 2 MB.')
    }
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
            Anak ke- (urutan lahir)
            <input
              v-model="form.birthOrder"
              type="number"
              min="1"
              step="1"
              class="input"
              placeholder="mis. 1, 2, 3 — untuk urutan antar saudara di pohon"
            />
          </label>
          <label class="form-field">
            Bio
            <textarea v-model="form.bio" class="input" rows="4"></textarea>
          </label>
          <div class="form-field">
            Photo
            <div class="photo-field">
              <div class="photo-preview">
                <img v-if="photoPreviewUrl" :src="photoPreviewUrl" alt="Photo preview" />
                <span v-else class="photo-preview-empty">300 &times; 300</span>
              </div>
              <input type="file" accept="image/*" @change="onFileChange" />
              <small class="text-muted">Format gambar, ukuran maksimal 2 MB.</small>
              <p v-if="photoError" class="error-text">{{ photoError }}</p>
            </div>
          </div>

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

      <aside class="card relations-panel">
        <h2>Family relationships <span v-if="!isEdit" class="text-muted">(optional)</span></h2>

        <!-- edit mode: live CRUD against the API -->
        <template v-if="isEdit">
          <p v-if="relError" class="error-text">{{ relError }}</p>

          <h3>Parents</h3>
          <ul class="rel-list">
            <li v-for="p in currentMember?.parents ?? []" :key="p">
              <span>{{ nameOf(p) }}</span>
              <button type="button" class="btn btn-secondary btn-sm" :disabled="relBusy" @click="removeRel('parent', p)">
                Remove
              </button>
            </li>
            <li v-if="!currentMember?.parents.length" class="text-muted">—</li>
          </ul>

          <h3>Children</h3>
          <ul class="rel-list">
            <li v-for="c in currentMember?.children ?? []" :key="c">
              <span>{{ nameOf(c) }}</span>
              <button type="button" class="btn btn-secondary btn-sm" :disabled="relBusy" @click="removeRel('child', c)">
                Remove
              </button>
            </li>
            <li v-if="!currentMember?.children.length" class="text-muted">—</li>
          </ul>

          <h3>Spouses</h3>
          <ul class="rel-list">
            <li v-for="s in currentMember?.spouses ?? []" :key="s">
              <span>{{ nameOf(s) }}</span>
              <button type="button" class="btn btn-secondary btn-sm" :disabled="relBusy" @click="removeRel('spouse', s)">
                Remove
              </button>
            </li>
            <li v-if="!currentMember?.spouses.length" class="text-muted">—</li>
          </ul>

          <h3>Add relationship</h3>
          <p v-if="memberOptions.length === 0" class="text-muted">Add more members first to link relationships.</p>
          <div v-else class="rel-row">
            <select v-model="newRelType" class="input">
              <option value="parent">Parent of...</option>
              <option value="child">Child of...</option>
              <option value="spouse">Spouse of...</option>
            </select>
            <button type="button" class="input picker-trigger" @click="openPicker('new')">
              <span :class="{ 'text-muted': !newRelId }">
                {{ newRelId ? selectedName(newRelId) : 'Select member' }}
              </span>
            </button>
            <button type="button" class="btn btn-primary" :disabled="!newRelId || relBusy" @click="addRel">Add</button>
          </div>
        </template>

        <!-- add mode: queued drafts, created after the member is saved -->
        <template v-else>
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

.relations-panel h3 {
  font-size: 0.9rem;
  margin: var(--space-3) 0 var(--space-1);
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

.photo-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin-top: var(--space-1);
}

.photo-preview {
  width: 300px;
  height: 300px;
  max-width: 100%;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.photo-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-preview-empty {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.rel-list {
  list-style: none;
  margin: 0 0 var(--space-2);
  padding: 0;
}

.rel-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: var(--space-1) 0;
}

.btn-sm {
  padding: var(--space-1) var(--space-2);
  font-size: 0.8rem;
  font-weight: 500;
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
