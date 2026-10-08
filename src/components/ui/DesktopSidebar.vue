<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'
import { useReviewStore } from '@/stores/useReviewStore'
import { usePairsStore } from '@/stores/usePairsStore'
import { APP_VERSION } from '@/config/version'

const route = useRoute()
const router = useRouter()
const reviewStore = useReviewStore()
const pairsStore = usePairsStore()

const pendingDue = computed(() => reviewStore.queueCounts.total)
const pairsPercent = computed(() => pairsStore.stats.percentage)

const GITHUB_REPO_URL = 'https://github.com/EDGAR-BRI/rubikbld'

const navItems = computed(() => [
  {
    name: 'Repasar',
    description: 'Sesión de práctica SRS',
    path: '/',
    icon: 'lucide:layers',
    badge: pendingDue.value > 0 ? pendingDue.value : null,
    badgeVariant: 'danger',
  },
  {
    name: 'Pares de Letras',
    description: 'Diccionario y mnemotecnias',
    path: '/pairs',
    icon: 'lucide:grid-2x2',
    progress: pairsPercent.value,
  },
  {
    name: 'Esquema del Cubo',
    description: 'Buffers y letras Speffz',
    path: '/scheme',
    icon: 'lucide:box',
  },
  {
    name: 'Ajustes',
    description: 'Drive, SRS y respaldo',
    path: '/settings',
    icon: 'lucide:settings-2',
  },
])

function navigateTo(path: string) {
  router.push(path)
}

function openGithub() {
  window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <aside
    class="w-64 h-full bg-dark-900/95 backdrop-blur-xl border-r border-dark-800/90 flex flex-col justify-between shrink-0 select-none z-30"
  >
    <!-- Top: Logo y Marca (altura unificada h-16 para formar una sola línea continua con AppHeader) -->
    <div>
      <div class="h-16 px-4 border-b border-dark-800/80 flex items-center justify-between shrink-0">
        <button
          type="button"
          class="flex items-center gap-3 text-left group cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded-xl -ml-1 p-1"
          title="Ir al inicio"
          @click="navigateTo('/')"
        >
          <img
            src="/favicon.png"
            alt="Memo Cube"
            class="w-9 h-9 rounded-xl object-contain drop-shadow-md border border-dark-700/60 bg-dark-950 p-0.5 group-hover:border-indigo-500/50 transition-colors"
          />
          <div>
            <h1 class="text-sm font-black tracking-tight text-white flex items-center gap-1.5 group-hover:text-indigo-300 transition-colors">
              <span>Memo Cube</span>
            </h1>
            <p class="text-[11px] text-slate-400 font-medium">Flashcards 3BLD</p>
          </div>
        </button>

        <span
          class="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
          title="Versión actual"
        >
          v{{ APP_VERSION }}
        </span>
      </div>

      <!-- Navigation Links -->
      <nav class="p-3 flex flex-col gap-1.5">
        <button
          v-for="item in navItems"
          :key="item.path"
          type="button"
          :class="[
            'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-150 group cursor-pointer',
            route.path === item.path
              ? 'bg-indigo-600/15 text-white border border-indigo-500/30 font-semibold shadow-sm shadow-indigo-950/40'
              : 'text-slate-300 hover:text-white hover:bg-dark-800/70 border border-transparent font-medium',
          ]"
          @click="navigateTo(item.path)"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              :class="[
                'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                route.path === item.path
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-dark-950/80 border border-dark-800 text-slate-400 group-hover:text-slate-200 group-hover:border-dark-700',
              ]"
            >
              <AppIcon :name="item.icon" :size="17" />
            </div>

            <div class="min-w-0 truncate">
              <span class="text-xs truncate block leading-tight">
                {{ item.name }}
              </span>
              <span class="text-[10px] text-slate-400 font-normal truncate block leading-tight mt-0.5">
                {{ item.description }}
              </span>
            </div>
          </div>

          <!-- Badges / Indicadores a la derecha -->
          <div class="shrink-0 flex items-center gap-1.5 ml-2">
            <span
              v-if="item.badge"
              class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500 text-white shadow-sm"
            >
              {{ item.badge > 99 ? '99+' : item.badge }}
            </span>

            <span
              v-else-if="item.progress !== undefined && item.progress > 0"
              class="text-[10px] font-mono font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-dark-950 border border-dark-800"
            >
              {{ item.progress }}%
            </span>
          </div>
        </button>
      </nav>
    </div>

    <!-- Bottom: Atajos de PC y Footer -->
    <div class="p-3 border-t border-dark-800/80 flex flex-col gap-3">
      <!-- Tip de atajos de teclado para PC -->
      <div class="p-2.5 rounded-xl bg-dark-950/70 border border-dark-800/90 text-[11px] text-slate-400 flex flex-col gap-1.5">
        <div class="flex items-center justify-between text-[10px] font-semibold text-slate-300">
          <span class="flex items-center gap-1">
            <AppIcon name="lucide:keyboard" :size="12" class-name="text-indigo-400" />
            <span>Atajos en Repaso</span>
          </span>
          <span class="text-[9px] text-slate-400 font-mono">PC</span>
        </div>
        <div class="flex items-center justify-between text-[10px]">
          <span>Mostrar respuesta:</span>
          <kbd class="px-1.5 py-0.5 bg-dark-900 border border-dark-700 rounded text-slate-300 font-mono text-[9px] shadow-xs">Espacio</kbd>
        </div>
        <div class="flex items-center justify-between text-[10px]">
          <span>Calificar tarjeta:</span>
          <kbd class="px-1.5 py-0.5 bg-dark-900 border border-dark-700 rounded text-slate-300 font-mono text-[9px] shadow-xs">1 - 4</kbd>
        </div>
      </div>

      <!-- Links del footer de la barra lateral -->
      <div class="flex items-center justify-between text-xs text-slate-400 px-1">
        <button
          type="button"
          class="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
          @click="openGithub"
        >
          <AppIcon name="lucide:github" :size="14" />
          <span class="text-[11px] font-medium">GitHub</span>
        </button>

        <span class="text-[11px] font-mono text-slate-400">
          v{{ APP_VERSION }}
        </span>
      </div>
    </div>
  </aside>
</template>
