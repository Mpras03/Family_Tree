<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMembersStore } from '@/stores/members'
import { useAuthStore } from '@/stores/auth'

const store = useMembersStore()
const auth = useAuthStore()
const router = useRouter()

const search = ref('')
const pageSize = ref(10)
const page = ref(1)

onMounted(() => store.fetchMembers())

const nameById = computed(() => {
  const map = new Map<string, string>()
  for (const m of store.members) map.set(m.id, m.fullName)
  return map
})

function parentNames(parents: string[] | undefined): string {
  if (!parents || parents.length === 0) return '—'
  return parents.map((id) => nameById.value.get(id) ?? id).join(', ')
}

interface Row {
  id: string
  fullName: string
  nickname: string
  parents: string
  gender: string
}

const rows = computed<Row[]>(() =>
  [...store.members]
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      nickname: m.nickname ?? '',
      parents: parentNames(m.parents),
      gender: m.gender,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName)),
)

const filtered = computed<Row[]>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter(
    (r) =>
      r.fullName.toLowerCase().includes(q) ||
      r.nickname.toLowerCase().includes(q) ||
      r.parents.toLowerCase().includes(q),
  )
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))

const paged = computed<Row[]>(() => {
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})

// keep the current page valid when the filter / page size shrinks the result set
watch([filtered, pageSize], () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})
watch(search, () => {
  page.value = 1
})

const rangeLabel = computed(() => {
  if (filtered.value.length === 0) return '0'
  const start = (page.value - 1) * pageSize.value + 1
  const end = Math.min(page.value * pageSize.value, filtered.value.length)
  return `${start}-${end} of ${filtered.value.length}`
})

function goTo(id: string) {
  router.push(`/members/${id}`)
}

function editMember(id: string) {
  router.push(`/members/${id}/edit`)
}

const deleteError = ref<string | null>(null)
const deletingId = ref<string | null>(null)

async function removeMember(row: Row) {
  if (!confirm(`Delete ${row.fullName}? This cannot be undone.`)) return
  deleteError.value = null
  deletingId.value = row.id
  try {
    await store.deleteMember(row.id)
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete member'
  } finally {
    deletingId.value = null
  }
}
</script>

<template>
  <div class="page">
    <div class="header">
      <h1>Family Members</h1>
      <RouterLink v-if="auth.canManageMembers" to="/members/new" class="btn btn-primary">+ Add member</RouterLink>
    </div>

    <p v-if="store.loading" class="text-muted">Loading...</p>
    <p v-else-if="store.error" class="error-text">{{ store.error }}</p>
    <template v-else>
      <div class="toolbar">
        <input
          v-model="search"
          class="input search"
          type="search"
          placeholder="Search by full name, nickname, or parent name..."
        />
        <label class="page-size">
          Rows per page
          <select v-model.number="pageSize" class="input">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
          </select>
        </label>
      </div>

      <p v-if="deleteError" class="error-text">{{ deleteError }}</p>

      <div class="table-wrap card">
        <table class="member-table">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Nick Name</th>
              <th>Nama Parent</th>
              <th>Gender</th>
              <th v-if="auth.canManageMembers" class="action-col">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in paged" :key="row.id">
              <td>{{ row.fullName }}</td>
              <td class="text-muted">{{ row.nickname || '—' }}</td>
              <td class="text-muted">{{ row.parents }}</td>
              <td>{{ row.gender }}</td>
              <td v-if="auth.canManageMembers" class="action-col">
                <div class="action-buttons">
                  <button
                    type="button"
                    class="icon-btn icon-btn-edit"
                    title="Edit"
                    aria-label="Edit member"
                    @click.stop="editMember(row.id)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M14.06 6.19l3.75 3.75L8.94 18.8H5.19v-3.75l8.87-8.86zm5.28-1.28l-1.75-1.75a1 1 0 0 0-1.41 0l-1.45 1.45 3.75 3.75 1.45-1.45a1 1 0 0 0 0-1.41z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn-view"
                    title="View"
                    aria-label="View member"
                    @click.stop="goTo(row.id)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn-delete"
                    title="Delete"
                    aria-label="Delete member"
                    :disabled="deletingId === row.id"
                    @click.stop="removeMember(row)"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M9 3h6l1 2h4v2H4V5h4l1-2zm-3 6h12l-1 12H7L6 9zm4 2v8h2v-8h-2zm4 0v8h2v-8h-2z"
                      />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filtered.length === 0">
              <td :colspan="auth.canManageMembers ? 5 : 4" class="text-muted empty">No members found.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <span class="text-muted">{{ rangeLabel }}</span>
        <div class="pager">
          <button class="btn btn-secondary" :disabled="page <= 1" @click="page--">Prev</button>
          <span class="text-muted">Page {{ page }} / {{ totalPages }}</span>
          <button class="btn btn-secondary" :disabled="page >= totalPages" @click="page++">Next</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-4);
}

.toolbar {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.search {
  flex: 1;
  min-width: 14rem;
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

.table-wrap {
  padding: 0;
  overflow-x: auto;
}

.member-table {
  width: 100%;
  border-collapse: collapse;
}

.member-table th,
.member-table td {
  text-align: left;
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.member-table thead th {
  font-size: 0.85rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
}

.member-table tbody tr:hover {
  background: var(--color-bg);
}

.member-table tbody tr:last-child td {
  border-bottom: none;
}

.member-table td.empty {
  text-align: center;
  cursor: default;
}

.action-col {
  width: 1%;
  white-space: nowrap;
}

.action-buttons {
  display: flex;
  gap: var(--space-2);
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: var(--radius-sm);
  border: 1px solid currentColor;
  background: transparent;
  cursor: pointer;
  line-height: 0;
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.icon-btn-edit {
  color: #16a34a;
}

.icon-btn-edit:hover:not(:disabled) {
  background: rgba(22, 163, 74, 0.12);
}

.icon-btn-view {
  color: #ca8a04;
}

.icon-btn-view:hover:not(:disabled) {
  background: rgba(202, 138, 4, 0.14);
}

.icon-btn-delete {
  color: #dc2626;
}

.icon-btn-delete:hover:not(:disabled) {
  background: rgba(220, 38, 38, 0.12);
}

.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-top: var(--space-3);
}

.pager {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
</style>
