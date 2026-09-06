<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import type { MemberDetail } from '@/stores/members'

const props = defineProps<{
  member: MemberDetail
  nameOf: (id: string) => string
}>()

const genderLabel = computed(() => (props.member.gender === 'female' ? 'Female' : 'Male'))
const photoUrl = computed(() =>
  props.member.photoKey ? `/api/photos/${props.member.photoKey}` : null,
)

const photoOpen = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') photoOpen.value = false
}

watch(photoOpen, (open) => {
  if (open) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="member-info">
    <div class="photo-wrap">
      <button
        v-if="photoUrl"
        type="button"
        class="photo photo-button"
        title="Lihat foto ukuran penuh"
        @click="photoOpen = true"
      >
        <img :src="photoUrl" :alt="member.fullName" />
      </button>
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

    <div class="relations">
      <h3>Parents</h3>
      <ul>
        <li v-for="p in member.parents" :key="p">{{ nameOf(p) }}</li>
        <li v-if="member.parents.length === 0" class="text-muted">—</li>
      </ul>
      <h3>Children</h3>
      <ul>
        <li v-for="c in member.children" :key="c">{{ nameOf(c) }}</li>
        <li v-if="member.children.length === 0" class="text-muted">—</li>
      </ul>
      <h3>Spouses</h3>
      <ul>
        <li v-for="s in member.spouses" :key="s">{{ nameOf(s) }}</li>
        <li v-if="member.spouses.length === 0" class="text-muted">—</li>
      </ul>
    </div>

    <Teleport to="body">
      <div
        v-if="photoOpen && photoUrl"
        class="photo-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label="Foto anggota"
        @click="photoOpen = false"
      >
        <img :src="photoUrl" :alt="member.fullName" @click.stop />
        <button type="button" class="photo-lightbox-close" aria-label="Tutup" @click="photoOpen = false">
          &times;
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.photo-wrap {
  margin: 0 0 var(--space-4);
}

.photo {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--color-border);
  background: var(--color-bg);
}

.photo-button {
  padding: 0;
  overflow: hidden;
  cursor: zoom-in;
  display: block;
}

.photo-button img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
}

.photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
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

.relations {
  margin-top: var(--space-4);
}

.relations h3 {
  font-size: 0.9rem;
  margin: var(--space-3) 0 var(--space-1);
}

.relations h3:first-child {
  margin-top: 0;
}

.relations ul {
  margin: 0;
  padding-left: var(--space-4);
}

.relations li {
  padding: 2px 0;
}

.photo-lightbox {
  position: fixed;
  inset: 0;
  z-index: 110;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
  cursor: zoom-out;
}

.photo-lightbox img {
  max-width: 92vw;
  max-height: 92vh;
  object-fit: contain;
  border-radius: var(--radius-sm);
  cursor: default;
}

.photo-lightbox-close {
  position: absolute;
  top: var(--space-3);
  right: var(--space-4);
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 1.6rem;
  line-height: 1;
  cursor: pointer;
}

.photo-lightbox-close:hover {
  background: rgba(255, 255, 255, 0.28);
}
</style>
