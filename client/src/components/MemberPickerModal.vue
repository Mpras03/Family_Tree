<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'

interface PickerOption {
  id: string
  fullName: string
  parents: string
  gender: 'male' | 'female'
}

const props = defineProps<{ options: PickerOption[] }>()
const emit = defineEmits<{ select: [id: string]; close: [] }>()

const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)
const pageSize = ref(10)
const page = ref(1)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(
    (o) => o.fullName.toLowerCase().includes(q) || o.parents.toLowerCase().includes(q),
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))

const paged = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

const rangeLabel = computed(() => {
  if (filtered.value.length === 0) return '0'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(page.value * pageSize.value, filtered.value.length)
  return `${start}-${end} of ${filtered.value.length}`
})

watch(search, () => {
  page.value = 1
})
watch([filtered, pageSize], () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})

function genderLabel(g: 'male' | 'female') {
  return g === 'female' ? 'Female' : 'Male'
}

onMounted(() => searchInput.value?.focus())
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal card" role="dialog" aria-modal="true" aria-label="Select member">
      <div class="modal-header">
        <h2>Select member</h2>
        <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
      </div>

      <div class="modal-toolbar">
        <input
          ref="searchInput"
          v-model="search"
          class="input search"
          type="search"
          placeholder="Search by name or parent..."
        />
        <label class="page-size">
          Rows
          <select v-model.number="pageSize" class="input">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
        </label>
      </div>

      <div class="modal-table-wrap">
        <table class="picker-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Parents</th>
              <th>Gender</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in paged" :key="o.id" @click="emit('select', o.id)">
              <td>{{ o.fullName }}</td>
              <td class="text-muted">{{ o.parents }}</td>
              <td>{{ genderLabel(o.gender) }}</td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="3" class="text-muted">No members found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="modal-pagination">
        <span class="text-muted">{{ rangeLabel }}</span>
        <div class="pager">
          <button type="button" class="btn btn-secondary" :disabled="page <= 1" @click="page--">Prev</button>
          <span class="text-muted">Page {{ page }} / {{ totalPages }}</span>
          <button type="button" class="btn btn-secondary" :disabled="page >= totalPages" @click="page++">
            Next
          </button>
        </div>
      </div>
    </div>
  </div>
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
  z-index: 50;
}

.modal {
  width: 100%;
  max-width: 40rem;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h2 {
  margin: 0;
}

.modal-toolbar {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
}

.modal-toolbar .search {
  flex: 1;
  min-width: 12rem;
}

.page-size {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.page-size select {
  width: auto;
}

.modal-table-wrap {
  overflow-y: auto;
  flex: 1;
}

.picker-table {
  width: 100%;
  border-collapse: collapse;
}

.picker-table th,
.picker-table td {
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.picker-table thead th {
  position: sticky;
  top: 0;
  background: var(--color-surface);
}

.picker-table tbody tr {
  cursor: pointer;
}

.picker-table tbody tr:hover {
  background: var(--color-bg);
}

.modal-pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.pager {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
</style>
