<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import * as f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'
import { useMembersStore, type MemberDetail } from '@/stores/members'

const store = useMembersStore()
const container = ref<HTMLElement | null>(null)
const loading = ref(true)
const busy = ref(false)
const errorMsg = ref<string | null>(null)
const hasMembers = ref(true)
const rootId = ref('')

type Datum = {
  id: string
  data: { gender: 'M' | 'F'; fullName: string; nickname: string; photoUrl: string }
  rels: { parents: string[]; children: string[]; spouses: string[] }
}

let chart: ReturnType<typeof f3.createChart> | null = null
let allData: Datum[] = []
// ids whose relatives (further from the root person) are folded into their card
const collapsed = new Set<string>()
// for each visible person: the neighbour one step closer to the root person
let parentOf = new Map<string, string>()

const rootOptions = computed(() =>
  [...store.members]
    .map((m) => ({ id: m.id, label: m.nickname ? `${m.fullName} (${m.nickname})` : m.fullName }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

function toChartDatum(m: MemberDetail): Datum {
  return {
    id: m.id,
    data: {
      gender: m.gender === 'male' ? 'M' : 'F',
      fullName: m.fullName,
      nickname: m.nickname ?? '',
      photoUrl: m.photoKey ? `/api/photos/${m.photoKey}` : '',
    },
    rels: {
      parents: [...m.parents],
      children: [...m.children],
      spouses: [...m.spouses],
    },
  }
}

// if someone has a single recorded parent whose spouse isn't already a parent,
// treat that spouse as the co-parent so couples show together in the tree
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

function neighbours(d: Datum) {
  return [...d.rels.parents, ...d.rels.children, ...d.rels.spouses]
}

// person from whom the widest slice of the family is reachable in one view
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

function computeVisible(): Datum[] {
  const byId = new Map(allData.map((d) => [d.id, d]))
  const main = rootId.value
  // breadth-first walk from the root person -> records how each node connects back
  const reached = new Set<string>([main])
  parentOf = new Map()
  const queue = [main]
  while (queue.length) {
    const id = queue.shift() as string
    const d = byId.get(id)
    if (!d) continue
    for (const n of neighbours(d)) {
      if (byId.has(n) && !reached.has(n)) {
        reached.add(n)
        parentOf.set(n, id)
        queue.push(n)
      }
    }
  }
  // hide a node when its path back to the root person crosses a collapsed person
  const shown = new Set(
    [...reached].filter((id) => {
      let cur = id
      while (parentOf.has(cur)) {
        cur = parentOf.get(cur) as string
        if (collapsed.has(cur)) return false
      }
      return true
    }),
  )
  return allData
    .filter((d) => shown.has(d.id))
    .map((d) => ({
      id: d.id,
      data: d.data,
      rels: {
        parents: d.rels.parents.filter((x) => shown.has(x)),
        children: d.rels.children.filter((x) => shown.has(x)),
        spouses: d.rels.spouses.filter((x) => shown.has(x)),
      },
    }))
}

// does this person have anyone hanging off them (further from the root)?
function hasFoldable(id: string): boolean {
  for (const start of parentOf.keys()) {
    let cur = start
    while (parentOf.has(cur)) {
      cur = parentOf.get(cur) as string
      if (cur === id) return true
    }
  }
  return false
}

// ids family-chart actually drew on screen for the current root
function renderedIds(): Set<string> {
  try {
    const tree = (chart as unknown as { store: { getTree: () => { data: { data: { id: string } }[] } } })
      .store.getTree()
    return new Set(tree.data.map((n) => n.data.id))
  } catch {
    return new Set()
  }
}

// does this person have real relatives that aren't visible from the current root?
function hasUnseenFamily(id: string): boolean {
  const known = new Set(allData.map((d) => d.id))
  const rendered = renderedIds()
  const d = allData.find((x) => x.id === id)
  if (!d) return false
  return neighbours(d).some((n) => known.has(n) && !rendered.has(n))
}

function push(position: 'inherit' | 'fit') {
  if (!chart) return
  chart.updateData(computeVisible() as never)
  chart.updateMainId(rootId.value as never)
  chart.updateTree({ tree_position: position })
}

function onCardClick(id: string) {
  // 1. already folded -> unfold it
  if (collapsed.has(id)) {
    collapsed.delete(id)
    push('inherit')
    return
  }
  // 2. this person has family that isn't visible from here -> re-root onto them
  if (id !== rootId.value && hasUnseenFamily(id)) {
    rootId.value = id
    collapsed.clear()
    push('fit')
    return
  }
  // 3. their relatives are all shown -> fold them into this card
  if (hasFoldable(id)) {
    collapsed.add(id)
    push('inherit')
  }
}

function changeRoot() {
  collapsed.clear()
  push('fit')
}

function collapseAll() {
  allData.forEach((d) => collapsed.add(d.id))
  collapsed.delete(rootId.value)
  push('inherit')
}

function expandAll() {
  collapsed.clear()
  push('fit')
}

async function loadData() {
  await store.fetchMembers()
  hasMembers.value = store.members.length > 0
  if (!hasMembers.value) return
  const details = await Promise.all(store.members.map((m) => store.fetchMember(m.id)))
  allData = details.map(toChartDatum)
  inferCoParents(allData)
  if (!allData.some((d) => d.id === rootId.value)) rootId.value = pickDefaultRoot()
}

async function refresh() {
  if (busy.value) return
  busy.value = true
  errorMsg.value = null
  try {
    await loadData()
    if (hasMembers.value) push('fit')
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

    chart = f3.createChart(container.value, computeVisible() as never)
    chart.setCardYSpacing(250)
    chart.setCardXSpacing(240)
    chart.setShowSiblingsOfMain(true)
    chart.setSingleParentEmptyCard(false)

    const card = chart.setCardHtml()
    card.setStyle('imageCircle')
    card.setCardDim({ w: 130, h: 130, img_w: 120, img_h: 120, img_x: 5, img_y: 5 })
    card.setCardDisplay([['fullName'], ['nickname']])
    card.setCardImageField('photoUrl')
    card.setMiniTree(false)

    // click a person = fold / unfold their relatives. no re-centering.
    card.setOnCardClick((_e: MouseEvent, d: { data: { id: string } }) => onCardClick(d.data.id))

    // "+" hint on cards that currently have relatives folded in
    card.setOnCardUpdate(function (this: HTMLElement, d: { data: { id: string } }) {
      const el = this.querySelector('.card') as HTMLElement | null
      if (el) el.classList.toggle('has-folded', collapsed.has(d.data.id))
    })

    chart.updateMainId(rootId.value as never)
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
      <div v-if="hasMembers && !loading && !errorMsg" class="tree-actions">
        <button class="btn btn-secondary" :disabled="busy" @click="refresh">
          {{ busy ? 'Memuat...' : 'Refresh data' }}
        </button>
        <button class="btn btn-secondary" @click="collapseAll">Ringkas semua</button>
        <button class="btn btn-secondary" @click="expandAll">Bentangkan semua</button>
      </div>
    </div>

    <div v-if="hasMembers && !loading && !errorMsg" class="tree-controls">
      <label class="root-picker">
        Lihat pohon dari
        <select v-model="rootId" class="input" @change="changeRoot">
          <option v-for="o in rootOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
      </label>
    </div>

    <p class="text-muted hint">
      Pohon digambar dari sudut pandang satu orang. Klik anggota yang keluarganya belum kelihatan
      (mis. pasangan yang orang tuanya belum muncul) &mdash; pohon otomatis pindah ke sudut pandang
      orang itu. Klik anggota yang kerabatnya sudah lengkap untuk melipat / membentangkan; klik lagi
      untuk mengembalikan. Bisa juga ganti sudut pandang lewat dropdown di atas.
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

.tree-actions {
  display: flex;
  gap: var(--space-2);
  flex-wrap: wrap;
}

.tree-controls {
  margin-bottom: var(--space-3);
}

.root-picker {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.9rem;
  color: var(--color-text-muted);
}

.root-picker select {
  min-width: 12rem;
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
</style>
