<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useMembersStore, type MemberDetail } from '@/stores/members'
import MemberInfo from '@/components/MemberInfo.vue'

const props = defineProps<{ memberId: string }>()
const emit = defineEmits<{ close: [] }>()

const store = useMembersStore()
const member = ref<MemberDetail | null>(null)
const loading = ref(true)
const errorMsg = ref<string | null>(null)

function nameOf(id: string) {
  return store.members.find((m) => m.id === id)?.fullName ?? id
}

async function load(id: string) {
  loading.value = true
  errorMsg.value = null
  member.value = null
  try {
    if (store.members.length === 0) await store.fetchMembers()
    member.value = await store.fetchMember(id)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Gagal memuat data anggota'
  } finally {
    loading.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

watch(() => props.memberId, (id) => load(id), { immediate: true })
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="emit('close')">
      <div class="modal card" role="dialog" aria-modal="true" aria-label="Detail anggota">
        <div class="modal-header">
          <h2>{{ member?.fullName ?? 'Detail anggota' }}</h2>
          <button type="button" class="btn btn-secondary" @click="emit('close')">Tutup</button>
        </div>

        <p v-if="loading" class="text-muted">Memuat...</p>
        <p v-else-if="errorMsg" class="error-text">{{ errorMsg }}</p>
        <div v-else-if="member" class="modal-body">
          <MemberInfo :member="member" :name-of="nameOf" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 60;
}

.modal {
  width: 100%;
  max-width: 36rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.modal-header h2 {
  margin: 0;
}

.modal-body {
  overflow-y: auto;
}
</style>
