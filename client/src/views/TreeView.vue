<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import * as f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'
import { useMembersStore, type MemberDetail } from '@/stores/members'
import MemberPickerModal from '@/components/MemberPickerModal.vue'

const store = useMembersStore()
const container = ref<HTMLElement | null>(null)
const loading = ref(true)
const busy = ref(false)
const errorMsg = ref<string | null>(null)
const hasMembers = ref(true)

// --- visualization state (kept fully separate from the relationship data) ---
const activeRootId = ref('')
const rootCollapsed = ref(false)

type Datum = {
  id: string
  data: {
    gender: 'M' | 'F'
    fullName: string
    nickname: string
    photoUrl: string
    birthOrder: number
  }
  rels: { parents: string[]; children: string[]; spouses: string[] }
}

let chart: ReturnType<typeof f3.createChart> | null = null
// --- relationship data (persistent, never mutated by expand/collapse) ---
let allData: Datum[] = []

const pickerOpen = ref(false)

const nameById = computed(() => {
  const map = new Map<string, string>()
  for (const m of store.members) map.set(m.id, m.fullName)
  return map
})

const pickerOptions = computed(() =>
  [...store.members]
    .map((m) => ({
      id: m.id,
      fullName: m.fullName,
      parents: (m.parents ?? []).map((p) => nameById.value.get(p) ?? p).join(', ') || '—',
      gender: m.gender,
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName)),
)

const activeRootLabel = computed(() => {
  const m = store.members.find((x) => x.id === activeRootId.value)
  if (!m) return 'Pilih anggota'
  return m.nickname ? `${m.fullName} (${m.nickname})` : m.fullName
})

function pickRoot(id: string) {
  pickerOpen.value = false
  handlePersonClick(id)
}

function toChartDatum(m: MemberDetail): Datum {
  return {
    id: m.id,
    data: {
      gender: m.gender === 'male' ? 'M' : 'F',
      fullName: m.fullName,
      nickname: m.nickname ?? '',
      photoUrl: m.photoKey ? `/api/photos/${m.photoKey}` : '',
      birthOrder: m.birthOrder ?? 999,
    },
    rels: {
      parents: [...m.parents],
      children: [...m.children],
      spouses: [...m.spouses],
    },
  }
}

// single recorded parent -> treat that parent's spouse as the co-parent so
// couples render together
function inferCoParents(data: Datum[]) {
  const byId = new Map(data.map((d) => [d.id, d]))
  for (const d of data) {
    if (d.rels.parents.length !== 1) continue
    const p = byId.get(d.rels.parents[0]!)
    if (!p) continue
    const co = p.rels.spouses.find((s) => s !== d.id && !d.rels.parents.includes(s) && byId.has(s))
    if (!co) continue
    d.rels.parents.push(co)
    const coDatum = byId.get(co)!
    if (!coDatum.rels.children.includes(d.id)) coDatum.rels.children.push(d.id)
  }
}

function known(id: string) {
  return allData.some((d) => d.id === id)
}

// default focus: the person from whom the widest slice of the family is reachable
function pickDefaultRoot(): string {
  const byId = new Map(allData.map((d) => [d.id, d]))
  const roots = allData.filter((d) => d.rels.parents.length === 0)
  const pool = roots.length ? roots : allData
  let best = pool[0]!.id
  let bestReach = -1
  for (const start of pool) {
    const seen = new Set([start.id])
    const q = [start.id]
    while (q.length) {
      const d = byId.get(q.shift() as string)
      if (!d) continue
      for (const n of [...d.rels.children, ...d.rels.spouses]) {
        if (byId.has(n) && !seen.has(n)) {
          seen.add(n)
          q.push(n)
        }
      }
    }
    if (seen.size > bestReach) {
      bestReach = seen.size
      best = start.id
    }
  }
  return best
}

function rootHasDescendants(): boolean {
  const root = allData.find((d) => d.id === activeRootId.value)
  return !!root && root.rels.children.length > 0
}

// snapshot for family-chart. when the root is collapsed its whole downstream
// (children, grandchildren, ...) is dropped from the snapshot only - the
// underlying relationship data is untouched.
function chartData(): Datum[] {
  const data: Datum[] = allData.map((d) => ({
    id: d.id,
    data: d.data,
    rels: {
      parents: [...d.rels.parents],
      children: [...d.rels.children],
      spouses: [...d.rels.spouses],
    },
  }))

  if (rootCollapsed.value) {
    const byId = new Map(data.map((d) => [d.id, d]))
    const root = byId.get(activeRootId.value)
    const drop = new Set<string>()
    const q = [...(root?.rels.children ?? [])]
    while (q.length) {
      const id = q.shift() as string
      if (drop.has(id) || !byId.has(id)) continue
      drop.add(id)
      q.push(...byId.get(id)!.rels.children)
    }
    const kept = data.filter((d) => !drop.has(d.id))
    for (const d of kept) {
      d.rels.parents = d.rels.parents.filter((x) => !drop.has(x))
      d.rels.children = d.rels.children.filter((x) => !drop.has(x))
      d.rels.spouses = d.rels.spouses.filter((x) => !drop.has(x))
    }
    return kept
  }
  return data
}

function render(position: 'inherit' | 'fit') {
  if (!chart) return
  chart.updateData(chartData() as never)
  chart.updateMainId(activeRootId.value as never)
  chart.updateTree({ tree_position: position })
}

// --- the one interaction rule -------------------------------------------------
// clicking a non-root person makes them the root; clicking the current root
// toggles its descendants between collapsed and expanded.
function handlePersonClick(id: string) {
  if (id !== activeRootId.value) {
    if (!known(id)) return
    activeRootId.value = id
    rootCollapsed.value = false
    render('fit')
    return
  }
  if (!rootHasDescendants()) return
  rootCollapsed.value = !rootCollapsed.value
  render('inherit')
}

async function loadData() {
  await store.fetchMembers()
  hasMembers.value = store.members.length > 0
  if (!hasMembers.value) return
  const details = await Promise.all(store.members.map((m) => store.fetchMember(m.id)))
  allData = details.map(toChartDatum)
  inferCoParents(allData)
  if (!known(activeRootId.value)) activeRootId.value = pickDefaultRoot()
}

async function refresh() {
  if (busy.value) return
  busy.value = true
  errorMsg.value = null
  try {
    await loadData()
    if (hasMembers.value) render('fit')
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to refresh'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    await loadData()
    if (!hasMembers.value || !container.value) return

    chart = f3.createChart(container.value, chartData() as never)
    chart.setCardYSpacing(250)
    chart.setCardXSpacing(240)
    chart.setShowSiblingsOfMain(true)
    chart.setSingleParentEmptyCard(false)
    // keep siblings in a fixed left-to-right order (anak ke-1, ke-2, ...)
    chart.setSortChildrenFunction(((a: { data: Datum['data'] }, b: { data: Datum['data'] }) =>
      (a.data.birthOrder ?? 999) - (b.data.birthOrder ?? 999)) as never)

    const card = chart.setCardHtml()
    card.setStyle('imageCircle')
    card.setCardDim({ w: 130, h: 130, img_w: 120, img_h: 120, img_x: 5, img_y: 5 })
    card.setCardDisplay([['fullName'], ['nickname']])
    card.setCardImageField('photoUrl')
    card.setMiniTree(false)

    card.setOnCardClick((_e: MouseEvent, d: { data: { id: string } }) => handlePersonClick(d.data.id))
    card.setOnCardUpdate(function (this: HTMLElement, d: { data: { id: string } }) {
      const el = this.querySelector('.card') as HTMLElement | null
      if (el) {
        el.classList.toggle('is-root', d.data.id === activeRootId.value)
        el.classList.toggle('has-folded', rootCollapsed.value && d.data.id === activeRootId.value)
      }
    })

    chart.updateMainId(activeRootId.value as never)
    chart.updateTree({ initial: true })
    loading.value = false
    await nextTick()
    chart.updateTree({ tree_position: 'fit', transition_time: 0 })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load tree'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page tree-page">
    <div class="tree-header">
      <div class="tree-title">
        <span class="tree-title-star">&#10022;</span>
        <h1>Family Tree</h1>
        <span class="tree-title-star">&#10022;</span>
      </div>
      <button
        v-if="hasMembers && !loading && !errorMsg"
        class="btn btn-secondary"
        :disabled="busy"
        @click="refresh"
      >
        {{ busy ? 'Memuat...' : 'Refresh data' }}
      </button>
    </div>

    <div v-if="hasMembers && !loading && !errorMsg" class="tree-controls">
      <span class="root-picker-label">Fokus ke</span>
      <button type="button" class="input root-picker-trigger" @click="pickerOpen = true">
        {{ activeRootLabel }}
      </button>
    </div>

    <p class="text-muted hint">
      Klik anggota mana pun untuk menjadikannya pusat pohon &mdash; orang tua, saudara, pasangan, dan
      keturunannya ikut tampil. Klik pusat pohon sekali lagi untuk melipat keturunannya; klik lagi
      untuk membentangkan.
    </p>

    <p v-if="loading" class="text-muted">Loading tree...</p>
    <p v-else-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-else-if="!hasMembers" class="text-muted">No members yet. Add some first.</p>
    <div
      v-show="!loading && !errorMsg && hasMembers"
      ref="container"
      id="FamilyChart"
      class="f3 tree-container"
    ></div>

    <MemberPickerModal
      v-if="pickerOpen"
      :options="pickerOptions"
      @select="pickRoot"
      @close="pickerOpen = false"
    />
  </div>
</template>

<style scoped>
.tree-page {
  max-width: 72rem;
}

.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-2);
}

.tree-title {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.tree-title h1 {
  margin: 0;
  letter-spacing: 0.02em;
}

.tree-title-star {
  color: var(--color-text-muted);
  font-size: 1.1rem;
}

.tree-controls {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-3);
}

.root-picker-label {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.root-picker-trigger {
  min-width: 14rem;
  text-align: left;
  cursor: pointer;
}

.hint {
  margin: 0 0 var(--space-4);
  font-size: 0.9rem;
  max-width: 46rem;
}

.tree-container {
  width: 100%;
  height: 78vh;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background-color: #edeef0;
  background-image:
    radial-gradient(circle at 50% -10%, rgba(100, 116, 139, 0.18), transparent 55%),
    radial-gradient(circle at 50% 120%, rgba(100, 116, 139, 0.12), transparent 45%);
}

/* family-chart node internals render dynamically -> :deep; the container
   itself carries .f3 so selectors must target descendants only */
.tree-container :deep(.card-image-circle) {
  --male-color: #6b7c93;
  --female-color: #b0868c;
}

/* thick connector lines between family members */
.tree-container :deep(path.link) {
  stroke: #374151 !important;
  stroke-width: 4px !important;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tree-container :deep(.card-image-circle .card-label) {
  background-color: rgba(17, 24, 39, 0.82);
  color: #fff;
  font-weight: 600;
}

.tree-container :deep(.card-main .card-inner) {
  outline-color: #111827;
}

.tree-container :deep(.card.has-folded .card-label::after) {
  content: ' +';
  opacity: 0.85;
}

/* drop the browser's focus rectangle on cards - the active root gets its own
   marker below */
.tree-container :deep(.card_cont:focus),
.tree-container :deep(.card_cont:focus-visible),
.tree-container :deep(.card:focus),
.tree-container :deep(.card:focus-visible) {
  outline: none;
}

/* active-root marker: black frame where the focus rectangle used to be, with a
   black glow pulsing outward from it */
.tree-container :deep(.card.is-root) {
  outline: 3px solid #111827;
  outline-offset: 5px;
  border-radius: 10px;
  animation: root-halo 1.8s ease-out infinite;
}

@keyframes root-halo {
  0% {
    box-shadow:
      0 0 0 0 rgba(17, 24, 39, 0.55),
      0 0 10px 2px rgba(17, 24, 39, 0.4);
  }
  70% {
    box-shadow:
      0 0 0 16px rgba(17, 24, 39, 0),
      0 0 24px 7px rgba(17, 24, 39, 0.28);
  }
  100% {
    box-shadow:
      0 0 0 0 rgba(17, 24, 39, 0),
      0 0 10px 2px rgba(17, 24, 39, 0.4);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tree-container :deep(.card.is-root) {
    animation: none;
    box-shadow: 0 0 16px 4px rgba(17, 24, 39, 0.4);
  }
}
</style>
