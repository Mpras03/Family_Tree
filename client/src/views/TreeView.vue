<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'
import { useMembersStore, type MemberDetail } from '@/stores/members'

const store = useMembersStore()
const container = ref<HTMLElement | null>(null)
const loading = ref(true)
const errorMsg = ref<string | null>(null)
const hasMembers = ref(true)

function toChartDatum(m: MemberDetail) {
  return {
    id: m.id,
    data: {
      gender: (m.gender === 'male' ? 'M' : 'F') as 'M' | 'F',
      fullName: m.fullName,
      nickname: m.nickname ?? '',
      photoUrl: m.photoKey ? `/api/photos/${m.photoKey}` : '',
    },
    rels: {
      parents: m.parents,
      spouses: m.spouses,
      children: m.children,
    },
  }
}

onMounted(async () => {
  try {
    await store.fetchMembers()
    hasMembers.value = store.members.length > 0
    if (!hasMembers.value || !container.value) return

    const details = await Promise.all(store.members.map((m) => store.fetchMember(m.id)))
    const data = details.map(toChartDatum)

    const chart = f3.createChart(container.value, data)
    const card = chart.setCardHtml()
    card.setCardDisplay([['fullName'], ['nickname']])
    card.setCardImageField('photoUrl')
    chart.updateTree({ initial: true })
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to load tree'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <h1>Family Tree</h1>
    <p v-if="loading" class="text-muted">Loading tree...</p>
    <p v-else-if="errorMsg" class="error-text">{{ errorMsg }}</p>
    <p v-else-if="!hasMembers" class="text-muted">No members yet. Add some first.</p>
    <div ref="container" id="FamilyChart" class="tree-container card"></div>
  </div>
</template>

<style scoped>
.tree-container {
  width: 100%;
  height: 80vh;
  padding: 0;
  overflow: hidden;
}
</style>
