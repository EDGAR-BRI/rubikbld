<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { db } from '@/db'
import { useNetwork } from '@vueuse/core'
import BottomNav from '@/components/ui/BottomNav.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import RubikLoader from '@/components/RubikLoader.vue'

import { usePairsStore } from '@/stores/usePairsStore'
import { usePwaInstall } from '@/composables/usePwaInstall'

const { isOnline } = useNetwork()
const isReady = ref(false)
const pairsStore = usePairsStore()

// Inicializar detector de eventos PWA
usePwaInstall()

onMounted(async () => {
  try {
    await db.initializeDefaults()
    // Pre-cargar pares en segundo plano para navegación instantánea
    pairsStore.loadPairs()
  } catch (err) {
    console.error('Error inicializando IndexedDB:', err)
  } finally {
    isReady.value = true
  }
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-dark-950 text-slate-100 select-none overflow-hidden">
    <!-- Offline status banner si no hay conexión (informa al usuario de que la app sigue 100% operativa) -->
    <div
      v-if="!isOnline"
      class="bg-amber-500/20 text-amber-300 border-b border-amber-500/30 px-3 py-1 text-center text-xs flex items-center justify-center gap-1.5 shrink-0 safe-top"
    >
      <AppIcon name="lucide:wifi-off" :size="14" />
      <span>Modo sin conexión activo — todas tus prácticas se guardan localmente</span>
    </div>

    <!-- Main View Area -->
    <main v-if="isReady" class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <router-view />
    </main>
    <div v-else class="flex-1 flex items-center justify-center">
      <RubikLoader label="Iniciando Rubik BLD..." />
    </div>

    <!-- Barra de navegación inferior móvil -->
    <BottomNav />
  </div>
</template>
