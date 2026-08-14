import { createRouter, createWebHistory } from 'vue-router'
import MemberListView from '@/views/MemberListView.vue'
import MemberFormView from '@/views/MemberFormView.vue'
import MemberDetailView from '@/views/MemberDetailView.vue'
import TreeView from '@/views/TreeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'members', component: MemberListView },
    { path: '/members/new', name: 'member-new', component: MemberFormView },
    { path: '/members/:id', name: 'member-detail', component: MemberDetailView, props: true },
    { path: '/members/:id/edit', name: 'member-edit', component: MemberFormView, props: true },
    { path: '/tree', name: 'tree', component: TreeView },
  ],
})

export default router
