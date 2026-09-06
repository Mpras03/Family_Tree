<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMembersStore, type MemberDetail } from '@/stores/members'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const store = useMembersStore()
const auth = useAuthStore()

const id = computed(() => route.params.id as string)
const member = ref<MemberDetail | null>(null)

async function load() {
  member.value = await store.fetchMember(id.value)
  if (store.members.length === 0) await store.fetchMembers()
}

onMounted(load)

function nameOf(memberId: string) {
  return store.members.find((m) => m.id === memberId)?.fullName ?? memberId
}

const genderLabel = computed(() => (member.value?.gender === 'female' ? 'Female' : 'Male'))
const photoUrl = computed(() =>
  member.value?.photoKey ? `/api/photos/${member.value.photoKey}` : null,
)
</script>

<template>
  <div v-if="member" class="page">
    <div class="card">
      <div class="header">
        <div>
          <h1>{{ member.fullName }}</h1>
          <p v-if="member.nickname" class="text-muted">"{{ member.nickname }}"</p>
        </div>
        <RouterLink v-if="auth.canManageMembers" :to="`/members/${member.id}/edit`" class="btn btn-secondary">
          Edit
        </RouterLink>
      </div>

      <div class="photo-wrap">
        <img v-if="photoUrl" :src="photoUrl" :alt="member.fullName" class="photo" />
        <div v-else class="photo photo-placeholder" aria-label="No photo">
          <svg viewBox="0 0 24 24" width="56" height="56" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5.33 0-8 2.67-8 6v2h16v-2c0-3.33-2.67-6-8-6z"
            />
          </svg>
        </div>
      </div>

      <dl class="info-grid">
        <div>
          <dt>Full name</dt>
          <dd>{{ member.fullName }}</dd>
        </div>
        <div>
          <dt>Nickname</dt>
          <dd>{{ member.nickname || '—' }}</dd>
        </div>
        <div>
          <dt>Phone number</dt>
          <dd>{{ member.phonenumber || '—' }}</dd>
        </div>
        <div>
          <dt>Gender</dt>
          <dd>{{ genderLabel }}</dd>
        </div>
        <div>
          <dt>Birth date</dt>
          <dd>{{ member.birthDate || '—' }}</dd>
        </div>
        <div>
          <dt>Death date</dt>
          <dd>{{ member.deathDate || '—' }}</dd>
        </div>
        <div>
          <dt>Anak ke- (urutan lahir)</dt>
          <dd>{{ member.birthOrder ?? '—' }}</dd>
        </div>
      </dl>

      <div class="bio-block">
        <dt>Bio</dt>
        <dd>{{ member.bio || '—' }}</dd>
      </div>
    </div>

    <section class="card relations-card">
      <h2>Parents</h2>
      <ul>
        <li v-for="p in member.parents" :key="p">{{ nameOf(p) }}</li>
        <li v-if="member.parents.length === 0" class="text-muted">—</li>
      </ul>
      <h2>Children</h2>
      <ul>
        <li v-for="c in member.children" :key="c">{{ nameOf(c) }}</li>
        <li v-if="member.children.length === 0" class="text-muted">—</li>
      </ul>
      <h2>Spouses</h2>
      <ul>
        <li v-for="s in member.spouses" :key="s">{{ nameOf(s) }}</li>
        <li v-if="member.spouses.length === 0" class="text-muted">—</li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.page > .card,
.page > section {
  margin-bottom: var(--space-4);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.photo-wrap {
  margin: var(--space-3) 0 var(--space-4);
}

.photo {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: var(--space-3);
  margin: 0;
}

.info-grid dt,
.bio-block dt {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text-muted);
  margin-bottom: 2px;
}

.info-grid dd,
.bio-block dd {
  margin: 0;
}

.bio-block {
  margin-top: var(--space-4);
}

.bio-block dd {
  white-space: pre-wrap;
}

.relations-card h2 {
  font-size: 1rem;
  margin-top: var(--space-3);
}

.relations-card h2:first-child {
  margin-top: 0;
}

.relations-card ul {
  margin: 0 0 var(--space-2);
  padding-left: var(--space-4);
}

.relations-card li {
  padding: var(--space-1) 0;
}
</style>
