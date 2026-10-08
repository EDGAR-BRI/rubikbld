<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppIcon from './AppIcon.vue'

defineProps<{
  title: string
  subtitle?: string
  showBack?: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

const router = useRouter()

function goToHome() {
  router.push('/')
}
</script>

<template>
  <header
    class="w-full bg-dark-900/95 backdrop-blur-md border-b border-dark-800/80 px-4 md:px-6 h-14 md:h-16 flex items-center justify-between z-30 shrink-0"
    style="padding-top: max(0rem, env(safe-area-inset-top, 0px));"
  >
    <div class="flex items-center gap-3 min-w-0">
      <button
        v-if="showBack"
        type="button"
        class="p-2 -ml-2 text-slate-300 hover:text-white rounded-lg hover:bg-dark-800 transition-colors cursor-pointer"
        @click="emit('back')"
      >
        <AppIcon name="lucide:arrow-left" :size="20" />
      </button>

      <!-- Logo solo visible en móvil (en PC ya está unificado en el Sidebar a la izquierda).
           Es clickeable para volver al inicio -->
      <button
        v-if="!showBack"
        type="button"
        class="shrink-0 flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500/40 rounded-lg md:hidden cursor-pointer active:scale-95 transition-transform"
        title="Ir al inicio"
        @click="goToHome"
      >
        <img
          src="/favicon.png"
          alt="Logo"
          class="w-7 h-7 rounded-lg object-contain shrink-0 drop-shadow-sm hover:opacity-90 transition-opacity"
        />
      </button>

      <div class="truncate">
        <h1 class="text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-2 truncate">
          {{ title }}
        </h1>
        <p v-if="subtitle" class="text-xs text-slate-400 truncate">
          {{ subtitle }}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </header>
</template>
