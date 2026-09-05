<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface PickerOption {
  id: string
  fullName: string
  parents: string
}

const props = defineProps<{ options: PickerOption[] }>()
const emit = defineEmits<{ select: [id: string]; close: [] }>()

const search = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter((o) => o.fullName.toLowerCase().includes(q))
})

onMounted(() => searchInput.value?.focus())
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')" @keydown.esc="emit('close')">
    <div class="modal card" role="dialog" aria-modal="true" aria-label="Select member">
      <div class="modal-header">
        <h2>Select member</h2>
        <button type="button" class="btn btn-secondary" @click="emit('close')">Close</button>
      </div>
      <input
        ref="searchInput"
        v-model="search"
        class="input"
        type="search"
        placeholder="Search by name..."
      />
      <div class="modal-table-wrap">
        <table class="picker-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Parents</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in filtered" :key="o.id" @click="emit('select', o.id)">
              <td>{{ o.fullName }}</td>
              <td class="text-muted">{{ o.parents }}</td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td colspan="2" class="text-muted">No members found.</td>
            </tr>
          </tbody>
        </table>
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
  max-width: 32rem;
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

.modal-table-wrap {
  overflow-y: auto;
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
</style>
