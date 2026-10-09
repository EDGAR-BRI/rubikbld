<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { db } from '@/db'
import { useNetwork } from '@vueuse/core'
import BottomNav from '@/components/ui/BottomNav.vue'
import DesktopSidebar from '@/components/ui/DesktopSidebar.vue'
import RubikLoader from '@/components/RubikLoader.vue'

import { usePairsStore } from '@/stores/usePairsStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { usePwaInstall } from '@/composables/usePwaInstall'
import { showSuccessToast, showWarningToast } from '@/utils/alerts'

const { isOnline } = useNetwork()
const isReady = ref(false)
const pairsStore = usePairsStore()
const settingsStore = useSettingsStore()

// Inicializar detector de eventos PWA
usePwaInstall()

// Notificaciones flotantes y sincronización automática al cambiar el estado de red
watch(isOnline, async (online, wasOnline) => {
  // Evitar disparar en el montaje inicial (wasOnline aún no definido)
  if (wasOnline === undefined) return

  if (!online) {
    showWarningToast(
      'Modo sin conexión',
      'Tus prácticas y tarjetas se guardan localmente en tu dispositivo.',
      3500,
    )
  } else {
    // Si el usuario vinculó su cuenta de Google
    const isConnected = await db.settings.get('google_is_connected')
    if (isConnected?.value) {
      if (settingsStore.autoSyncDrive) {
        // Modo automático: subir respaldo en segundo plano
        const synced = await settingsStore.syncWithDrive(false)
        if (synced) {
          showSuccessToast(
            'Conexión restaurada',
            'Tus datos se sincronizaron con Google Drive.',
            3000,
          )
          return
        }
      } else {
        // Modo manual: solo renovar silenciosamente el token sin subir datos
        settingsStore.silentRefreshGoogleToken().catch(() => {})
      }
    }

    showSuccessToast('Conexión restaurada', 'Has vuelto a estar en línea.', 2500)
  }
})

onMounted(async () => {
  try {
    await db.initializeDefaults()
    // Cargar ajustes y restaurar sesión persistente de Google
    await settingsStore.loadSettings()
    // Pre-cargar pares en segundo plano para navegación instantánea
    pairsStore.loadPairs()

    // Notificar discretamente si se inicia la aplicación sin conexión
    if (!isOnline.value) {
      showWarningToast(
        'Modo sin conexión',
        'Tus prácticas y tarjetas se guardan localmente en tu dispositivo.',
        3500,
      )
    }
  } catch (err) {
    console.error('Error inicializando IndexedDB:', err)
  } finally {
    isReady.value = true
  }
})
</script>

<template>
  <div class="w-full h-full flex flex-col md:flex-row bg-dark-950 text-slate-100 select-none overflow-hidden">
    <!-- Barra lateral para PC / Escritorio -->
    <DesktopSidebar v-if="isReady" class="hidden md:flex" />

    <!-- Área principal de la aplicación -->
    <div class="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
      <!-- Main View Area -->
      <main v-if="isReady" class="flex-1 flex flex-col min-h-0 overflow-hidden">
        <router-view />
      </main>
      <div v-else class="flex-1 flex items-center justify-center">
        <RubikLoader label="Iniciando Memo Cube..." />
      </div>

      <!-- Barra de navegación inferior móvil (solo en pantallas táctiles/móviles < md) -->
      <BottomNav class="md:hidden" />
    </div>
  </div>
</template>
