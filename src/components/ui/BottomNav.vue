<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { useReviewStore } from '@/stores/useReviewStore'

const route = useRoute()
const router = useRouter()
const reviewStore = useReviewStore()

const pendingDue = computed(() => reviewStore.queueCounts.total)

const navItems = computed(() => [
  {
    name: 'Repasar',
    path: '/',
    icon: 'lucide:layers',
    badge: pendingDue.value > 0 ? pendingDue.value : null,
  },
  {
    name: 'Pares',
    path: '/pairs',
    icon: 'lucide:grid-2x2',
  },
  {
    name: 'Esquema',
    path: '/scheme',
    icon: 'lucide:box',
  },
  {
    name: 'Ajustes',
    path: '/settings',
    icon: 'lucide:settings-2',
  },
])

function navigateTo(path: string) {
  router.push(path)
}
</script>

<template>
  <nav
    class="w-full bg-dark-900/95 backdrop-blur-lg border-t border-dark-800/80 px-2 py-1 safe-bottom z-30 shrink-0 select-none shadow-2xl"
  >
    <div class="flex items-center justify-around max-w-lg mx-auto">
      <button
        v-for="item in navItems"
        :key="item.path"
        type="button"
        :class="[
          'relative flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-150',
          route.path === item.path
            ? 'text-indigo-400 font-semibold'
            : 'text-slate-400 hover:text-slate-200 font-normal',
        ]"
        @click="navigateTo(item.path)"
      >
        <div class="relative flex items-center justify-center">
          <AppIcon
            :name="item.icon"
            :size="22"
            :class-name="route.path === item.path ? 'scale-110 transition-transform' : ''"
          />

          <!-- Badge de pendientes -->
          <span
            v-if="item.badge"
            class="absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm"
          >
            {{ item.badge > 99 ? '99+' : item.badge }}
          </span>
        </div>

        <span class="text-[11px] mt-1 tracking-tight">
          {{ item.name }}
        </span>

        <!-- Active bottom bar indicator dot -->
        <span
          v-if="route.path === item.path"
          class="absolute bottom-1 w-1 h-1 bg-indigo-500 rounded-full"
        />
      </button>
    </div>
  </nav>
</template>
