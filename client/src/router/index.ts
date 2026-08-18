import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '@/views/LandingView.vue'
import LoginView from '@/views/LoginView.vue'
import AdminUsersView from '@/views/AdminUsersView.vue'
import MemberListView from '@/views/MemberListView.vue'
import MemberFormView from '@/views/MemberFormView.vue'
import MemberDetailView from '@/views/MemberDetailView.vue'
import TreeView from '@/views/TreeView.vue'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'landing', component: LandingView, meta: { public: true } },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    {
      path: '/admin/users',
      name: 'admin-users',
      component: AdminUsersView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    { path: '/members', name: 'members', component: MemberListView, meta: { requiresAuth: true } },
    {
      path: '/members/new',
      name: 'member-new',
      component: MemberFormView,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    {
      path: '/members/:id',
      name: 'member-detail',
      component: MemberDetailView,
      props: true,
      meta: { requiresAuth: true },
    },
    {
      path: '/members/:id/edit',
      name: 'member-edit',
      component: MemberFormView,
      props: true,
      meta: { requiresAuth: true, requiresAdmin: true },
    },
    { path: '/tree', name: 'tree', component: TreeView, meta: { requiresAuth: true } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.initialized) {
    await auth.fetchMe()
  }

  if (to.meta.public) {
    if (auth.user) return { path: '/members' }
    return true
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  if (to.meta.requiresAdmin && auth.user?.role !== 'admin') {
    return { path: '/members' }
  }

  return true
})

export default router
