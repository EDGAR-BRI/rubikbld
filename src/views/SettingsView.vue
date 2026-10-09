<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { googleDriveService } from '@/services/googleDrive'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import CardGestureHelpModal from '@/components/card/CardGestureHelpModal.vue'
import {
  showSuccessToast,
  showErrorToast,
  showConfirm,
  showInfoToast,
  showPwaInstallInstructions,
} from '@/utils/alerts'
import { usePwaInstall } from '@/composables/usePwaInstall'
import { useAppUpdate } from '@/composables/useAppUpdate'
import { useNetwork } from '@vueuse/core'
import { APP_VERSION } from '@/config/version'
import AppUpdateModal from '@/components/ui/AppUpdateModal.vue'

import { usePairsStore } from '@/stores/usePairsStore'
import { useSchemeStore } from '@/stores/useSchemeStore'
import { useReviewStore } from '@/stores/useReviewStore'
import { db } from '@/db'

const settingsStore = useSettingsStore()
const pairsStore = usePairsStore()
const schemeStore = useSchemeStore()
const reviewStore = useReviewStore()
void reviewStore
const isSyncingPairs = ref(false)
const isResettingProgress = ref(false)
void isResettingProgress
const { isInstalled, isIOS, promptInstall } = usePwaInstall()
const { isOnline } = useNetwork()
const {
  isCheckingUpdate,
  updateStatusText,
  updateDetailText,
  checkForUpdates,
} = useAppUpdate()

const showGestureModal = ref(false)

const GITHUB_REPO_URL = 'https://github.com/EDGAR-BRI/rubikbld'
const GITHUB_ISSUES_URL = 'https://github.com/EDGAR-BRI/rubikbld/issues'
const GITHUB_PULLS_URL = 'https://github.com/EDGAR-BRI/rubikbld/pulls'

const clientIdInput = ref('')
const showManualClientId = ref(false)
const jsonFileInputRef = ref<HTMLInputElement | null>(null)
const jsonStatusMsg = ref<string | null>(null)

onMounted(async () => {
  await settingsStore.loadSettings()
  await pairsStore.loadPairs()
  await schemeStore.loadScheme()
  clientIdInput.value = settingsStore.googleClientId
  if (!settingsStore.googleClientId) {
    showManualClientId.value = true
  }
})

async function handleSyncPairs() {
  isSyncingPairs.value = true
  try {
    await db.syncPairsWithScheme(schemeStore.currentScheme)
    await pairsStore.loadPairs(true)
    showSuccessToast('Pares sincronizados', 'Tu base de datos se ha actualizado con el esquema actual del cubo')
  } catch (err: any) {
    showErrorToast('Error al sincronizar', err?.message || 'No se pudieron sincronizar los pares')
  } finally {
    isSyncingPairs.value = false
  }
}

async function handleArchiveOutsidePairs() {
  const count = pairsStore.pairsOutsideScheme.length
  if (count === 0) return
  const letters = pairsStore.outsideSchemeLetters.join(', ')
  const res = await showConfirm(
    `¿Archivar ${count} pares fuera de esquema?`,
    `Estos pares (letras: ${letters}) se ocultarán de tus listas activas y no aparecerán en repasos.`,
    `Sí, archivar ${count} pares`,
    'Cancelar',
  )
  if (!res.isConfirmed) return
  await pairsStore.archiveAllOutsideScheme()
  showSuccessToast('Pares archivados', `Se archivaron ${count} pares correctamente`)
}

async function handleDeleteOutsidePairs() {
  const count = pairsStore.pairsOutsideScheme.length
  if (count === 0) return
  const letters = pairsStore.outsideSchemeLetters.join(', ')
  const res = await showConfirm(
    `¿Eliminar definitivamente ${count} pares fuera de esquema?`,
    `Se borrarán permanentemente estos ${count} pares (letras: ${letters}) y sus tarjetas. Esta acción no se puede revertir.`,
    `Sí, eliminar definitivamente`,
    'Cancelar',
  )
  if (!res.isConfirmed) return
  await pairsStore.deleteAllOutsideScheme()
  showSuccessToast('Pares eliminados', `Se eliminaron ${count} pares del sistema`)
}

async function handleResetAllMemorization() {
  const result = await showConfirm(
    '¿Reiniciar la memorización de todos los pares?',
    'Todas tus tarjetas SRS volverán al estado «Nueva» con 0 repeticiones e intervalo inicial. Tu lista de palabras mnemotécnicas, imágenes, notas y pares se mantendrán 100% intactos.',
    'Sí, reiniciar memorización',
    'Cancelar',
  )

  if (!result.isConfirmed) return

  isResettingProgress.value = true
  try {
    const count = await reviewStore.resetAllProgress()
    showSuccessToast(
      'Memorización reiniciada',
      `Se restablecieron ${count} tarjetas al estado inicial. Tus palabras e imágenes están a salvo.`,
    )
  } catch (err: any) {
    showErrorToast('Error al reiniciar', err?.message || 'No se pudo reiniciar la memorización')
  } finally {
    isResettingProgress.value = false
  }
}

async function saveGoogleClientId() {
  await settingsStore.saveGoogleClientId(clientIdInput.value)
  showSuccessToast('Client ID guardado', 'Configuración de Google OAuth lista')
}

async function handleSignInGoogle() {
  await settingsStore.signInWithGoogle()
  if (settingsStore.syncStatus.error) {
    showErrorToast('Error al conectar con Google', settingsStore.syncStatus.error)
  } else if (settingsStore.syncStatus.isSignedIn) {
    showSuccessToast(
      'Cuenta conectada',
      `Sesión iniciada como ${settingsStore.syncStatus.user?.name || 'usuario'}`,
    )
  }
}

async function handleSignOutGoogle() {
  const confirmRes = await showConfirm(
    '¿Desconectar cuenta de Google?',
    'Se cerrará la sesión de Google Drive en este dispositivo. Tus datos locales se conservarán intactos.',
    'Sí, desconectar',
  )
  if (!confirmRes.isConfirmed) return

  await settingsStore.signOutFromGoogle()
  showInfoToast('Sesión cerrada', 'Se ha desconectado tu cuenta de Google')
}

async function handleToggleTilt(val: boolean) {
  if (val && typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
    try {
      const res = await (DeviceOrientationEvent as any).requestPermission()
      if (res !== 'granted') {
        showErrorToast('Permiso denegado', 'iOS Safari requiere permiso para acceder al giroscopio')
        settingsStore.setEnableTiltGestures(false)
        return
      }
    } catch (err: any) {
      showErrorToast('Error de sensor', err?.message || 'No se pudo acceder al giroscopio')
    }
  }
  await settingsStore.setEnableTiltGestures(val)
  showSuccessToast(
    val ? 'Control por inclinación activado' : 'Control por inclinación desactivado',
    val ? 'Inclina el móvil a los lados para calificar manos libres' : 'Usa gestos de deslizamiento o botones para calificar',
  )
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) return 'Nunca'
  return new Date(timestamp).toLocaleString()
}

// Respaldo manual en archivo JSON
async function exportJsonBackup() {
  try {
    const jsonStr = await googleDriveService.exportLocalData()
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rubikbld_backup_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    showSuccessToast('Respaldo descargado', 'Archivo JSON guardado en tu dispositivo')
  } catch (err: any) {
    showErrorToast('Error al exportar', err.message)
  }
}

async function onJsonFileSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  const confirmRes = await showConfirm(
    '¿Restaurar archivo JSON?',
    'Se reemplazarán los datos locales con el contenido del archivo.',
    'Sí, restaurar',
  )
  if (!confirmRes.isConfirmed) return

  try {
    const text = await file.text()
    await googleDriveService.importLocalData(text)
    showSuccessToast('¡Datos restaurados!', 'Recargando aplicación...')
    setTimeout(() => window.location.reload(), 1200)
  } catch (err: any) {
    showErrorToast('Error al importar', err.message)
  } finally {
    if (jsonFileInputRef.value) jsonFileInputRef.value.value = ''
  }
}

async function handleExportToDrive() {
  await settingsStore.exportToDrive()
  if (settingsStore.syncStatus.error) {
    showErrorToast('Error al exportar a Drive', settingsStore.syncStatus.error)
  } else {
    showSuccessToast('Exportado con éxito', 'Datos guardados en tu Google Drive')
  }
}

async function handleImportFromDrive() {
  const confirmRes = await showConfirm(
    '¿Importar desde Google Drive?',
    'Se descargarán tus datos desde tu Google Drive reemplazando los locales en este dispositivo.',
    'Sí, importar',
  )
  if (!confirmRes.isConfirmed) return

  await settingsStore.importFromDrive()
  if (settingsStore.syncStatus.error) {
    showErrorToast('Error al importar de Drive', settingsStore.syncStatus.error)
  } else {
    showSuccessToast('¡Datos importados!', 'Recargando aplicación...')
    setTimeout(() => window.location.reload(), 1200)
  }
}

async function handleInstallPwa() {
  if (isInstalled.value) {
    showInfoToast('Aplicación ya instalada', 'Memo Cube ya está instalada y lista en tu dispositivo')
    return
  }

  const result = await promptInstall()

  if (result === 'accepted') {
    showSuccessToast('¡Instalación exitosa!', 'Memo Cube se ha instalado en tu dispositivo')
  } else if (result === 'dismissed') {
    // Diálogo nativo rechazado o postergado por el usuario
  } else {
    // Si no está disponible el prompt automático (iOS Safari, navegador sin prompt, etc.)
    showPwaInstallInstructions(isIOS)
  }
}

function openGithubUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-dark-950">
    <AppHeader title="Ajustes" />

    <div class="flex-1 overflow-y-auto p-4 md:p-6 pb-28 md:pb-12 max-w-lg md:max-w-5xl mx-auto w-full flex flex-col gap-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <!-- Columna 1: Google Drive y Práctica -->
        <div class="flex flex-col gap-6">
          <!-- SECCIÓN 1: Google Drive Sync -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
            <AppIcon name="lucide:cloud" :size="20" />
          </div>
          <div>
            <h2 class="text-base font-bold text-white">Google Drive Sync</h2>
            <p class="text-xs text-slate-400">Sin backend: Tus datos e imágenes van directo a tu Drive</p>
          </div>
        </div>

        <!-- Estado 1: Usuario NO conectado -->
        <div v-if="!settingsStore.syncStatus.isSignedIn" class="flex flex-col gap-4">
          <p class="text-xs text-slate-300 leading-relaxed">
            Inicia sesión con tu cuenta de Google para respaldar tus pares de letras, imágenes y progresos de estudio directamente en tu Google Drive personal.
          </p>

          <!-- Botón de Conexión de 1 clic con Google -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-2xl bg-white text-slate-900 font-semibold text-sm hover:bg-slate-100 active:scale-[0.98] transition-all shadow-md group disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            :disabled="!isOnline || settingsStore.syncStatus.isSyncing"
            @click="handleSignInGoogle"
          >
            <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>{{ isOnline ? 'Continuar con Google' : 'Conexión a internet requerida' }}</span>
          </button>

          <!-- Enlaces de consentimiento OAuth -->
          <p class="text-[11px] text-center text-slate-500 leading-normal px-2">
            Al conectar, aceptas nuestra
            <router-link to="/privacy" class="text-green-400 hover:underline">Política de Privacidad</router-link>
            y
            <router-link to="/terms" class="text-green-400 hover:underline">Condiciones del Servicio</router-link>.
          </p>

          <!-- Toggle para configuración manual avanzada de Client ID -->
          <div class="pt-1">
            <button
              type="button"
              class="text-[11px] text-slate-500 hover:text-green-400 flex items-center gap-1.5 transition-colors mx-auto"
              @click="showManualClientId = !showManualClientId"
            >
              <AppIcon :name="showManualClientId ? 'lucide:chevron-up' : 'lucide:settings-2'" :size="12" />
              <span>{{ showManualClientId ? 'Ocultar Client ID personalizado' : 'Configurar Client ID personalizado' }}</span>
            </button>

            <div v-if="showManualClientId" class="mt-3 p-3 bg-dark-950/70 border border-dark-800 rounded-2xl flex flex-col gap-2">
              <AppInput
                v-model="clientIdInput"
                label="Google OAuth Client ID"
                placeholder="xxxx.apps.googleusercontent.com"
                icon="lucide:key"
                clearable
              />
              <div class="flex items-center justify-between text-[11px] text-slate-500">
                <span>Desde Google Cloud Console</span>
                <button
                  type="button"
                  class="text-green-400 hover:underline font-medium"
                  @click="saveGoogleClientId"
                >
                  Guardar ID
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Estado 2: Usuario CONECTADO -->
        <div v-else class="flex flex-col gap-4">
          <!-- Card de perfil del usuario -->
          <div class="flex items-center justify-between p-3.5 bg-dark-950/80 rounded-2xl border border-dark-800">
            <div class="flex items-center gap-3 min-w-0">
              <img
                v-if="settingsStore.syncStatus.user?.picture"
                :src="settingsStore.syncStatus.user.picture"
                class="w-10 h-10 rounded-full border border-dark-700 shrink-0 object-cover"
                alt="Avatar"
              />
              <div
                v-else
                class="w-10 h-10 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 shrink-0 font-bold"
              >
                {{ settingsStore.syncStatus.user?.name?.charAt(0) || 'U' }}
              </div>

              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <p class="text-sm font-bold text-white truncate">
                    {{ settingsStore.syncStatus.user?.name }}
                  </p>
                  <span
                    v-if="!isOnline"
                    class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0"
                  >
                    Conectado (Sin red)
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0"
                  >
                    Conectado
                  </span>
                </div>
                <p class="text-xs text-slate-400 truncate">
                  {{ settingsStore.syncStatus.user?.email }}
                </p>
              </div>
            </div>

            <!-- Botón desconectar -->
            <button
              type="button"
              class="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors shrink-0"
              title="Desconectar cuenta"
              @click="handleSignOutGoogle"
            >
              <AppIcon name="lucide:log-out" :size="18" />
            </button>
          </div>

          <!-- Selector de Modo de Sincronización: Automático vs Manual -->
          <div class="p-3.5 bg-dark-950/80 rounded-2xl border border-dark-800 flex flex-col gap-2">
            <AppSwitch
              v-model="settingsStore.autoSyncDrive"
              label="Sincronización automática"
              description="Respaldar tus cambios en Google Drive al volver a tener conexión"
              @change="(val: boolean) => {
                settingsStore.setAutoSyncDrive(val)
                showSuccessToast(
                  val ? 'Sincronización automática activada' : 'Modo manual activado',
                  val ? 'Tus datos se respaldarán automáticamente al recuperar conexión' : 'Solo se respaldará cuando pulses «Exportar a Drive»',
                )
              }"
            />
            <p class="text-[11px] text-slate-400 pl-0.5">
              {{ settingsStore.autoSyncDrive
                ? '⚡ Automático: Tus tarjetas y repasos se respaldan en segundo plano al recuperar internet.'
                : '🔒 Manual: Sin subidas en segundo plano. Solo se respalda cuando pulses «Exportar a Drive».' }}
            </p>
          </div>

          <!-- Botones de Google Drive (Exportar / Importar) -->
          <div class="grid grid-cols-2 gap-2">
            <AppButton
              variant="primary"
              size="md"
              icon="lucide:cloud-upload"
              :loading="settingsStore.syncStatus.isSyncing"
              :disabled="!isOnline || settingsStore.syncStatus.isSyncing"
              @click="handleExportToDrive"
            >
              Exportar a Drive
            </AppButton>

            <AppButton
              variant="secondary"
              size="md"
              icon="lucide:cloud-download"
              :disabled="!isOnline || settingsStore.syncStatus.isSyncing"
              @click="handleImportFromDrive"
            >
              Importar de Drive
            </AppButton>
          </div>

          <!-- Aviso cuando está sin conexión -->
          <div
            v-if="!isOnline"
            class="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 flex items-center gap-2"
          >
            <AppIcon name="lucide:wifi-off" :size="13" class-name="shrink-0 text-amber-400" />
            <span>Sin conexión. La sincronización se reanudará en cuanto recuperes la conexión.</span>
          </div>

          <!-- Info última exportación -->
          <div class="text-xs text-slate-400 flex items-center justify-between px-1">
            <span class="flex items-center gap-1.5">
              <AppIcon name="lucide:clock" :size="13" class-name="text-slate-500" />
              Última exportación:
            </span>
            <span class="font-mono text-slate-300">
              {{ formatDate(settingsStore.syncStatus.lastSyncTime) }}
            </span>
          </div>
        </div>

        <p v-if="settingsStore.syncStatus.error" class="text-xs text-rose-400 mt-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5">
          {{ settingsStore.syncStatus.error }}
        </p>
      </div>

      <!-- SECCIÓN 2: Opciones de Práctica y SRS -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
            <AppIcon name="lucide:sliders" :size="20" />
          </div>
          <div>
            <h2 class="text-base font-bold text-white">Configuración de Repaso</h2>
            <p class="text-xs text-slate-400">Ajustes del algoritmo tipo Anki</p>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <!-- Toggle Solo Pares Completados -->
          <AppSwitch
            v-model="settingsStore.practiceOnlyCompleted"
            label="Solo pares completados"
            description="No incluir pares que aún no tengan palabra asignada"
            @change="(val: boolean) => {
              settingsStore.setPracticeOnlyCompleted(val)
              showSuccessToast(val ? 'Filtro activado' : 'Filtro desactivado', val ? 'Practicando solo pares con palabra' : 'Practicando todos los pares')
            }"
          />

          <!-- Toggle Modo Inverso -->
          <div class="pt-3 border-t border-dark-800">
            <AppSwitch
              v-model="settingsStore.reversePractice"
              label="Modo Inverso"
              description="Ver palabra/imagen primero y adivinar el par de letras"
              @change="(val: boolean) => {
                settingsStore.setReversePractice(val)
                showSuccessToast(val ? 'Modo Inverso activado' : 'Modo Estándar activado', val ? 'Adivinarás las letras a partir de la imagen/palabra' : 'Verás las letras y recordarás la palabra')
              }"
            />
          </div>

          <!-- Nuevas cartas por día -->
          <div class="pt-3 border-t border-dark-800">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-slate-200">Nuevas tarjetas por día</span>
              <span class="font-mono font-bold text-green-400 text-sm">
                {{ settingsStore.srsSettings.newCardsPerDay }}
              </span>
            </div>
            <input
              v-model.number="settingsStore.srsSettings.newCardsPerDay"
              type="range"
              min="5"
              max="60"
              step="5"
              class="w-full accent-green-500 bg-dark-950 rounded-lg h-2 cursor-pointer"
              @change="settingsStore.saveSRSSettings(settingsStore.srsSettings)"
            />
          </div>

          <!-- Reiniciar Memorización SRS de todos los pares -->
          <div class="pt-4 border-t border-dark-800 flex flex-col gap-2.5">
            <div>
              <span class="text-sm font-bold text-white flex items-center gap-1.5">
                <AppIcon name="lucide:rotate-ccw" :size="15" class-name="text-rose-400" />
                <span>Reiniciar memorización de todos los pares</span>
              </span>
              <p class="text-xs text-slate-400 mt-1 leading-relaxed">
                Vuelve todas las tarjetas al estado «Nueva» con 0 repasos para empezar de cero el estudio. Tus palabras mnemotécnicas, imágenes y notas se mantendrán 100% intactas.
              </p>
            </div>

            <AppButton
              variant="danger"
              size="md"
              icon="lucide:rotate-ccw"
              :loading="isResettingProgress"
              class="w-full justify-center"
              @click="handleResetAllMemorization"
            >
              Reiniciar memorización de todos los pares
            </AppButton>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 2.1: Gestos Móviles de Tarjetas (Swipe SRS) -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <AppIcon name="lucide:hand" :size="20" />
            </div>
            <div>
              <h2 class="text-base font-bold text-white">Gestos de Tarjetas</h2>
              <p class="text-xs text-slate-400">Califica deslizando con 1 solo dedo (el pulgar)</p>
            </div>
          </div>
          <button
            type="button"
            class="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-xl transition-colors"
            @click="showGestureModal = true"
          >
            <AppIcon name="lucide:help-circle" :size="13" />
            <span>Guía</span>
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <!-- Toggle Activar Gestos -->
          <AppSwitch
            v-model="settingsStore.enableCardGestures"
            label="Gestos de deslizamiento"
            description="Desliza con 1 solo dedo en cualquier dirección con ayuda visual tipo Gmail"
            @change="(val: boolean) => {
              settingsStore.setEnableCardGestures(val)
              showSuccessToast(val ? 'Gestos activados' : 'Gestos desactivados', val ? 'Desliza las tarjetas para calificar' : 'Usa solo los botones para calificar')
            }"
          />

          <!-- Toggle Calificar sin voltear -->
          <div class="pt-3 border-t border-dark-800">
            <AppSwitch
              v-model="settingsStore.allowSwipeBeforeFlip"
              label="Calificar sin voltear"
              description="Permite deslizar directamente desde el frente para repasos ultra rápidos"
              @change="(val: boolean) => {
                settingsStore.setAllowSwipeBeforeFlip(val)
                showSuccessToast(val ? 'Repaso rápido activado' : 'Volteo obligatorio activado', val ? 'Puedes calificar sin voltear la tarjeta' : 'Debes voltear la tarjeta antes de calificar')
              }"
            />
          </div>

          <!-- Selector de Sensibilidad -->
          <div class="pt-3 border-t border-dark-800">
            <div class="flex items-center justify-between mb-2">
              <span class="text-sm font-medium text-slate-200">Sensibilidad de deslizamiento</span>
              <span class="text-xs font-mono text-slate-400">
                {{ settingsStore.gestureSensitivity === 'high' ? 'Sensible (55px)' : settingsStore.gestureSensitivity === 'low' ? 'Firme (95px)' : 'Normal (75px)' }}
              </span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <button
                type="button"
                :class="[
                  'py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center',
                  settingsStore.gestureSensitivity === 'high'
                    ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/20'
                    : 'bg-dark-950 text-slate-400 border-dark-800 hover:text-white',
                ]"
                @click="settingsStore.setGestureSensitivity('high')"
              >
                Sensible
              </button>
              <button
                type="button"
                :class="[
                  'py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center',
                  settingsStore.gestureSensitivity === 'normal'
                    ? 'bg-green-600 text-white border-green-500 shadow-md shadow-green-600/20'
                    : 'bg-dark-950 text-slate-400 border-dark-800 hover:text-white',
                ]"
                @click="settingsStore.setGestureSensitivity('normal')"
              >
                Normal
              </button>
              <button
                type="button"
                :class="[
                  'py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center',
                  settingsStore.gestureSensitivity === 'low'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                    : 'bg-dark-950 text-slate-400 border-dark-800 hover:text-white',
                ]"
                @click="settingsStore.setGestureSensitivity('low')"
              >
                Firme
              </button>
            </div>
          </div>

          <!-- Cheat sheet de direcciones -->
          <div class="pt-3 border-t border-dark-800 grid grid-cols-2 gap-2 text-xs">
            <div class="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-2">
              <span class="font-bold text-emerald-400 text-sm">→</span>
              <div>
                <p class="font-bold text-emerald-300">Derecha</p>
                <p class="text-[10px] text-slate-400">Bien</p>
              </div>
            </div>

            <div class="p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 flex items-center gap-2">
              <span class="font-bold text-rose-400 text-sm">←</span>
              <div>
                <p class="font-bold text-rose-300">Izquierda</p>
                <p class="text-[10px] text-slate-400">Otra vez</p>
              </div>
            </div>

            <div class="p-2.5 rounded-xl bg-sky-950/30 border border-sky-800/40 flex items-center gap-2">
              <span class="font-bold text-sky-400 text-sm">↑</span>
              <div>
                <p class="font-bold text-sky-300">Arriba</p>
                <p class="text-[10px] text-slate-400">Fácil</p>
              </div>
            </div>

            <div class="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center gap-2">
              <span class="font-bold text-amber-400 text-sm">↓</span>
              <div>
                <p class="font-bold text-amber-300">Abajo</p>
                <p class="text-[10px] text-slate-400">Difícil</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 2.2: Control por Giroscopio Estilo Látigo (Manos Libres) -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <AppIcon name="lucide:zap" :size="20" />
            </div>
            <div>
              <h2 class="text-base font-bold text-white">Giroscopio Estilo Látigo</h2>
              <p class="text-xs text-slate-400">Giro rápido de muñeca (Manos libres)</p>
            </div>
          </div>
          <button
            type="button"
            class="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl transition-colors"
            @click="showGestureModal = true"
          >
            <AppIcon name="lucide:help-circle" :size="13" />
            <span>Guía</span>
          </button>
        </div>

        <div class="flex flex-col gap-4">
          <!-- Toggle Giroscopio Látigo -->
          <AppSwitch
            v-model="settingsStore.enableTiltGestures"
            label="Gesto estilo látigo"
            description="Califica dando un giro seco con la muñeca. Solo activo cuando la tarjeta está dada vuelta."
            @change="handleToggleTilt"
          />

          <!-- Opciones de inclinación cuando está activo -->
          <template v-if="settingsStore.enableTiltGestures">
            <!-- Selector de Sensibilidad de látigo -->
            <div class="pt-3 border-t border-dark-800">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-slate-200">Sensibilidad del latigazo</span>
                <span class="text-xs font-mono text-slate-400">
                  {{ settingsStore.tiltSensitivity === 'high' ? 'Sensible (95°/s)' : settingsStore.tiltSensitivity === 'low' ? 'Firme (160°/s)' : 'Normal (120°/s)' }}
                </span>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  :class="[
                    'py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center',
                    settingsStore.tiltSensitivity === 'high'
                      ? 'bg-sky-600 text-white border-sky-500 shadow-md shadow-sky-600/20'
                      : 'bg-dark-950 text-slate-400 border-dark-800 hover:text-white',
                  ]"
                  @click="settingsStore.setTiltSensitivity('high')"
                >
                  Sensible
                </button>
                <button
                  type="button"
                  :class="[
                    'py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center',
                    settingsStore.tiltSensitivity === 'normal'
                      ? 'bg-green-600 text-white border-green-500 shadow-md shadow-green-600/20'
                      : 'bg-dark-950 text-slate-400 border-dark-800 hover:text-white',
                  ]"
                  @click="settingsStore.setTiltSensitivity('normal')"
                >
                  Normal
                </button>
                <button
                  type="button"
                  :class="[
                    'py-2 px-3 rounded-xl text-xs font-bold transition-all border text-center',
                    settingsStore.tiltSensitivity === 'low'
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
                      : 'bg-dark-950 text-slate-400 border-dark-800 hover:text-white',
                  ]"
                  @click="settingsStore.setTiltSensitivity('low')"
                >
                  Firme
                </button>
              </div>
            </div>

            <!-- Cheat sheet de direcciones de latigazo -->
            <div class="pt-3 border-t border-dark-800 grid grid-cols-2 gap-2 text-xs">
              <div class="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-2">
                <span class="font-bold text-emerald-400 text-sm">⚡→</span>
                <div>
                  <p class="font-bold text-emerald-300">Latigazo Derecha</p>
                  <p class="text-[10px] text-slate-400">Bien</p>
                </div>
              </div>

              <div class="p-2.5 rounded-xl bg-rose-950/30 border border-rose-800/40 flex items-center gap-2">
                <span class="font-bold text-rose-400 text-sm">←⚡</span>
                <div>
                  <p class="font-bold text-rose-300">Latigazo Izquierda</p>
                  <p class="text-[10px] text-slate-400">Otra vez</p>
                </div>
              </div>

              <div class="p-2.5 rounded-xl bg-sky-950/30 border border-sky-800/40 flex items-center gap-2">
                <span class="font-bold text-sky-400 text-sm">⬆️⚡</span>
                <div>
                  <p class="font-bold text-sky-300">Latigazo Adelante</p>
                  <p class="text-[10px] text-slate-400">Fácil</p>
                </div>
              </div>

              <div class="p-2.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-center gap-2">
                <span class="font-bold text-amber-400 text-sm">⬇️⚡</span>
                <div>
                  <p class="font-bold text-amber-300">Latigazo Hacia Ti</p>
                  <p class="text-[10px] text-slate-400">Difícil</p>
                </div>
              </div>
            </div>

            <div class="p-3 bg-dark-950/80 rounded-2xl border border-dark-800 text-[11px] text-slate-400 flex items-start gap-2">
              <AppIcon name="lucide:shield-check" :size="16" class="text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Seguridad anti-salto:</strong> El giroscopio solo se activa tras voltear la tarjeta. Así nunca se pasarán dos tarjetas seguidas por error. Voltea primero para ver la respuesta y luego gira la muñeca con un movimiento seco.
              </span>
            </div>
          </template>
        </div>
      </div>
        </div>

        <!-- Columna 2: Respaldos locales, PWA y Código Abierto -->
        <div class="flex flex-col gap-6">
          <!-- SECCIÓN 3: Respaldo Manual en Archivo JSON -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <AppIcon name="lucide:file-code" :size="20" />
          </div>
          <div>
            <h2 class="text-base font-bold text-white">Copia de Seguridad Local</h2>
            <p class="text-xs text-slate-400">Guarda o restaura un archivo JSON de respaldo</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <AppButton
            variant="secondary"
            size="md"
            icon="lucide:download"
            @click="exportJsonBackup"
          >
            Exportar JSON
          </AppButton>

          <AppButton
            variant="secondary"
            size="md"
            icon="lucide:upload"
            @click="jsonFileInputRef?.click()"
          >
            Importar JSON
          </AppButton>
        </div>

        <p v-if="jsonStatusMsg" class="text-xs text-green-400 mt-3 text-center">
          {{ jsonStatusMsg }}
        </p>

        <input
          ref="jsonFileInputRef"
          type="file"
          accept=".json,application/json"
          class="hidden"
          @change="onJsonFileSelected"
        />
      </div>

      <!-- SECCIÓN 3.5: Esquema y Limpieza de Pares -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AppIcon name="lucide:layers" :size="20" />
          </div>
          <div>
            <h2 class="text-base font-bold text-white">Limpieza y Esquema de Pares</h2>
            <p class="text-xs text-slate-400">Depuración de pares obsoletos y control de archivo</p>
          </div>
        </div>

        <div class="flex flex-col gap-3 text-xs">
          <div class="grid grid-cols-2 gap-2 text-slate-300">
            <div class="p-2.5 rounded-xl bg-dark-950 border border-dark-800 flex flex-col">
              <span class="text-[10px] text-slate-500 uppercase font-semibold">Total Pares</span>
              <span class="font-mono font-bold text-sm text-white mt-0.5">{{ pairsStore.pairs.length }}</span>
            </div>
            <div class="p-2.5 rounded-xl bg-dark-950 border border-dark-800 flex flex-col">
              <span class="text-[10px] text-slate-500 uppercase font-semibold">Archivados</span>
              <span class="font-mono font-bold text-sm text-amber-400 mt-0.5">{{ pairsStore.stats.archivedCount }}</span>
            </div>
          </div>

          <!-- Si hay pares fuera de esquema -->
          <div
            v-if="pairsStore.pairsOutsideScheme.length > 0"
            class="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2"
          >
            <div class="flex items-center justify-between">
              <span class="font-bold text-amber-300 flex items-center gap-1.5">
                <AppIcon name="lucide:alert-triangle" :size="14" />
                <span>{{ pairsStore.pairsOutsideScheme.length }} pares fuera de esquema</span>
              </span>
              <span class="text-[10px] font-mono text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">
                {{ pairsStore.outsideSchemeLetters.join(', ') }}
              </span>
            </div>
            <p class="text-[11px] text-amber-300/80 leading-relaxed">
              Estos pares contienen letras que ya no forman parte de tu cubo. Puedes archivarlos para ocultarlos o borrarlos definitivamente.
            </p>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                class="py-1.5 px-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold border border-amber-500/30 text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                @click="handleArchiveOutsidePairs"
              >
                <AppIcon name="lucide:archive" :size="13" />
                <span>Archivar ({{ pairsStore.pairsOutsideScheme.length }})</span>
              </button>
              <button
                type="button"
                class="py-1.5 px-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold border border-rose-500/30 text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                @click="handleDeleteOutsidePairs"
              >
                <AppIcon name="lucide:trash-2" :size="13" />
                <span>Eliminar ({{ pairsStore.pairsOutsideScheme.length }})</span>
              </button>
            </div>
          </div>

          <div v-else class="p-2.5 rounded-xl bg-dark-950/60 border border-dark-800 text-[11px] text-slate-400 flex items-center gap-2">
            <AppIcon name="lucide:check-circle-2" :size="14" class-name="text-green-400 shrink-0" />
            <span>Todos tus pares coinciden con el esquema actual del cubo.</span>
          </div>

          <!-- Botón sincronizar pares -->
          <AppButton
            variant="secondary"
            size="md"
            icon="lucide:refresh-cw"
            :loading="isSyncingPairs"
            class="w-full justify-center mt-1"
            @click="handleSyncPairs"
          >
            Sincronizar pares con el esquema activo
          </AppButton>
        </div>
      </div>

      <!-- SECCIÓN 4: Instalación de la Aplicación (PWA) -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <AppIcon name="lucide:download-cloud" :size="20" />
            </div>
            <div>
              <h2 class="text-base font-bold text-white">Instalar Aplicación</h2>
              <p class="text-xs text-slate-400">Acceso directo y uso 100% offline</p>
            </div>
          </div>
          <AppBadge v-if="isInstalled" variant="success" size="sm">
            Instalada
          </AppBadge>
          <AppBadge v-else variant="primary" size="sm">
            PWA Lista
          </AppBadge>
        </div>

        <!-- Si ya está instalada -->
        <div
          v-if="isInstalled"
          class="flex items-start gap-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl mb-4 text-left"
        >
          <div class="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
            <AppIcon name="lucide:check-circle-2" :size="18" />
          </div>
          <div>
            <p class="text-sm font-semibold text-emerald-300">¡App instalada en tu dispositivo!</p>
            <p class="text-xs text-slate-300 mt-0.5">
              Estás usando Memo Cube como aplicación instalada. Puedes abrirla directamente desde tu pantalla de inicio y utilizarla sin conexión en cualquier momento.
            </p>
          </div>
        </div>

        <!-- Si no está instalada -->
        <div v-else class="flex flex-col gap-3 mb-4">
          <p class="text-xs text-slate-300 leading-relaxed">
            Instala la aplicación en tu smartphone u ordenador para entrenar a pantalla completa, con carga ultra rápida y sin necesidad de conexión a internet.
          </p>

          <AppButton
            variant="primary"
            size="md"
            icon="lucide:download"
            class="w-full justify-center bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-green-600/30"
            @click="handleInstallPwa"
          >
            Instalar en este dispositivo
          </AppButton>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-dark-800 text-xs text-slate-400">
          <span>¿Cómo instalar manualmente?</span>
          <button
            type="button"
            class="text-sky-400 hover:underline flex items-center gap-1 font-medium"
            @click="showPwaInstallInstructions(isIOS)"
          >
            <AppIcon name="lucide:help-circle" :size="14" />
            <span>Ver instrucciones</span>
          </button>
        </div>
      </div>

      <!-- SECCIÓN 5: Código Abierto & Contribuciones en GitHub -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl mb-4">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-white">
              <AppIcon name="lucide:github" :size="20" />
            </div>
            <div>
              <h2 class="text-base font-bold text-white">Código Abierto</h2>
              <p class="text-xs text-slate-400">Repositorio en GitHub & Comunidad</p>
            </div>
          </div>
          <AppBadge variant="neutral" size="sm">
            Open Source
          </AppBadge>
        </div>

        <p class="text-xs text-slate-300 leading-relaxed mb-4">
          Memo Cube es un proyecto de código abierto desarrollado para la comunidad de cuberos a ciegas (3BLD). Si deseas revisar el código, reportar un problema o hacer una aportación con nuevas funciones, ¡tu ayuda es muy bienvenida!
        </p>

        <!-- Versión de la Aplicación (package.json) -->
        <div class="flex items-center justify-between p-3.5 bg-dark-950/80 rounded-2xl border border-dark-800 mb-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
              <AppIcon name="lucide:tag" :size="16" />
            </div>
            <div>
              <p class="text-xs font-bold text-white">Versión de la Aplicación</p>
              <p class="text-[11px] text-slate-400">package.json</p>
            </div>
          </div>
          <span class="font-mono text-xs font-bold px-3 py-1 rounded-xl bg-green-500/15 text-green-300 border border-green-500/30 shadow-xs">
            v{{ APP_VERSION }}
          </span>
        </div>

        <!-- Botones de Acción GitHub -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <AppButton
            variant="secondary"
            size="md"
            icon="lucide:github"
            class="justify-center hover:border-slate-500 hover:text-white"
            @click="openGithubUrl(GITHUB_REPO_URL)"
          >
            GitHub
          </AppButton>

          <AppButton
            variant="ghost"
            size="md"
            icon="lucide:git-pull-request"
            class="justify-center border border-dark-800 hover:border-slate-600 hover:bg-dark-800/80 text-slate-300"
            @click="openGithubUrl(GITHUB_PULLS_URL)"
          >
            Pull Requests
          </AppButton>

          <AppButton
            variant="ghost"
            size="md"
            icon="lucide:bug"
            class="justify-center border border-dark-800 hover:border-slate-600 hover:bg-dark-800/80 text-slate-300"
            @click="openGithubUrl(GITHUB_ISSUES_URL)"
          >
            Issues
          </AppButton>
        </div>

        <div class="mt-4 pt-3 border-t border-dark-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <div class="flex items-center gap-3">
            <router-link to="/privacy" class="hover:text-slate-300 hover:underline">Política de Privacidad</router-link>
            <span>•</span>
            <router-link to="/terms" class="hover:text-slate-300 hover:underline">Condiciones de Servicio</router-link>
          </div>
          <button
            type="button"
            class="flex items-center gap-1 text-green-400 hover:underline"
            @click="openGithubUrl(GITHUB_REPO_URL)"
          >
            <span>github.com/EDGAR-BRI/rubikbld</span>
            <AppIcon name="lucide:external-link" :size="12" />
          </button>
        </div>
      </div>
        </div>
      </div>

      <!-- SECCIÓN FINAL: Actualizaciones y Nueva Versión (Abajo de Ajustes) -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3.5 w-full sm:w-auto">
          <div class="w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <AppIcon name="lucide:refresh-cw" :size="20" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base font-bold text-white">Actualizaciones de la App</h2>
              <span class="font-mono text-[11px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                v{{ APP_VERSION }}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              Comprueba si hay una nueva versión disponible y actualiza los archivos locales
            </p>
          </div>
        </div>

        <AppButton
          variant="primary"
          size="md"
          icon="lucide:refresh-cw"
          class="w-full sm:w-auto justify-center bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg shadow-emerald-950/40 shrink-0"
          :disabled="isCheckingUpdate"
          @click="checkForUpdates"
        >
          Buscar nueva versión y actualizar
        </AppButton>
      </div>

      <!-- Footer informativo con versión -->
      <div class="mt-2 text-center text-xs text-slate-500 flex flex-col items-center gap-1 pb-4">
        <p class="font-medium text-slate-400">Memo Cube • v{{ APP_VERSION }}</p>
        <p class="text-[11px] text-slate-600">Entrenamiento 3BLD Offline-First con Repetición Espaciada</p>
      </div>
    </div>

    <!-- Modal de ayuda interactiva para los gestos táctiles -->
    <CardGestureHelpModal v-model="showGestureModal" />

    <!-- Modal de carga con loader 3D del cubo para búsqueda de actualizaciones -->
    <AppUpdateModal
      v-model="isCheckingUpdate"
      :status-text="updateStatusText"
      :detail-text="updateDetailText"
      :current-version="APP_VERSION"
    />
  </div>
</template>
