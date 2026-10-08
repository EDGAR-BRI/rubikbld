import { createRouter, createWebHistory } from 'vue-router'
import StudyView from '@/views/StudyView.vue'
import PairsView from '@/views/PairsView.vue'
import SchemeView from '@/views/SchemeView.vue'
import SettingsView from '@/views/SettingsView.vue'

const routes = [
  {
    path: '/',
    name: 'study',
    component: StudyView,
  },
  {
    path: '/pairs',
    name: 'pairs',
    component: PairsView,
  },
  {
    path: '/scheme',
    name: 'scheme',
    component: SchemeView,
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsView,
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('@/views/PrivacyView.vue'),
  },
  {
    path: '/terms',
    name: 'terms',
    component: () => import('@/views/TermsView.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
