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
import {
  showSuccessToast,
  showErrorToast,
  showConfirm,
  showInfoToast,
  showPwaInstallInstructions,
} from '@/utils/alerts'
import { usePwaInstall } from '@/composables/usePwaInstall'

const settingsStore = useSettingsStore()
const { isInstalled, isIOS, promptInstall } = usePwaInstall()

const GITHUB_REPO_URL = 'https://github.com/EDGAR-BRI/rubikbld'
const GITHUB_ISSUES_URL = 'https://github.com/EDGAR-BRI/rubikbld/issues'
const GITHUB_PULLS_URL = 'https://github.com/EDGAR-BRI/rubikbld/pulls'

const clientIdInput = ref('')
const jsonFileInputRef = ref<HTMLInputElement | null>(null)
const jsonStatusMsg = ref<string | null>(null)

onMounted(async () => {
  await settingsStore.loadSettings()
  clientIdInput.value = settingsStore.googleClientId
})

async function saveGoogleClientId() {
  await settingsStore.saveGoogleClientId(clientIdInput.value)
  showSuccessToast('Client ID guardado', 'Configuración de Google OAuth lista')
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

async function handleSyncWithDrive() {
  await settingsStore.syncWithDrive()
  if (settingsStore.syncStatus.error) {
    showErrorToast('Error en Drive', settingsStore.syncStatus.error)
  } else {
    showSuccessToast('Sincronizado con éxito', 'Datos respaldados en tu Google Drive')
  }
}

async function handleRestoreFromDrive() {
  const confirmRes = await showConfirm(
    '¿Restaurar desde Google Drive?',
    'Se descargarán tus datos desde tu Drive reemplazando los locales.',
    'Sí, descargar',
  )
  if (!confirmRes.isConfirmed) return

  await settingsStore.restoreFromDrive()
  if (settingsStore.syncStatus.error) {
    showErrorToast('Error al restaurar', settingsStore.syncStatus.error)
  } else {
    showSuccessToast('¡Restaurado con éxito!', 'Datos sincronizados desde tu Drive')
  }
}

async function handleInstallPwa() {
  if (isInstalled.value) {
    showInfoToast('Aplicación ya instalada', 'Rubik BLD ya está instalada y lista en tu dispositivo')
    return
  }

  const result = await promptInstall()

  if (result === 'accepted') {
    showSuccessToast('¡Instalación exitosa!', 'Rubik BLD se ha instalado en tu dispositivo')
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

    <div class="flex-1 overflow-y-auto p-4 pb-28 max-w-lg mx-auto w-full flex flex-col gap-6">
      <!-- SECCIÓN 1: Google Drive Sync -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <AppIcon name="lucide:cloud" :size="20" />
          </div>
          <div>
            <h2 class="text-base font-bold text-white">Google Drive Sync</h2>
            <p class="text-xs text-slate-400">Sin backend: Tus datos e imágenes van directo a tu Drive</p>
          </div>
        </div>

        <!-- Usuario conectado -->
        <div
          v-if="settingsStore.syncStatus.isSignedIn && settingsStore.syncStatus.user"
          class="flex items-center gap-3 p-3 bg-dark-950/80 rounded-2xl border border-dark-800 mb-4"
        >
          <img
            :src="settingsStore.syncStatus.user.picture"
            class="w-10 h-10 rounded-full border border-dark-700"
            alt="Avatar"
          />
          <div class="truncate">
            <p class="text-sm font-bold text-white truncate">
              {{ settingsStore.syncStatus.user.name }}
            </p>
            <p class="text-xs text-slate-400 truncate">
              {{ settingsStore.syncStatus.user.email }}
            </p>
          </div>
        </div>

        <!-- Configuración de Client ID -->
        <div class="flex flex-col gap-3 mb-4">
          <AppInput
            v-model="clientIdInput"
            label="Google OAuth Client ID"
            placeholder="xxxx.apps.googleusercontent.com"
            icon="lucide:key"
            clearable
          />

          <div class="flex items-center justify-between text-xs text-slate-500">
            <span>¿Dónde obtenerlo? En Google Cloud Console (OAuth Web)</span>
            <button
              type="button"
              class="text-indigo-400 hover:underline font-medium"
              @click="saveGoogleClientId"
            >
              Guardar ID
            </button>
          </div>
        </div>

        <!-- Botones de Sincronización -->
        <div class="flex flex-col gap-2">
          <AppButton
            variant="primary"
            size="md"
            icon="lucide:refresh-cw"
            :loading="settingsStore.syncStatus.isSyncing"
            @click="handleSyncWithDrive"
          >
            Sincronizar a Google Drive
          </AppButton>

          <AppButton
            variant="secondary"
            size="md"
            icon="lucide:cloud-download"
            :disabled="settingsStore.syncStatus.isSyncing"
            @click="handleRestoreFromDrive"
          >
            Restaurar desde Google Drive
          </AppButton>
        </div>

        <div class="mt-3 text-xs text-slate-400 flex items-center justify-between">
          <span>Última sincronización:</span>
          <span class="font-mono text-slate-300">
            {{ formatDate(settingsStore.syncStatus.lastSyncTime) }}
          </span>
        </div>

        <p v-if="settingsStore.syncStatus.error" class="text-xs text-rose-400 mt-2">
          {{ settingsStore.syncStatus.error }}
        </p>
      </div>

      <!-- SECCIÓN 2: Opciones de Práctica y SRS -->
      <div class="bg-dark-900 border border-dark-800 rounded-3xl p-5 shadow-xl">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
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
              <span class="font-mono font-bold text-indigo-400 text-sm">
                {{ settingsStore.srsSettings.newCardsPerDay }}
              </span>
            </div>
            <input
              v-model.number="settingsStore.srsSettings.newCardsPerDay"
              type="range"
              min="5"
              max="60"
              step="5"
              class="w-full accent-indigo-500 bg-dark-950 rounded-lg h-2 cursor-pointer"
              @change="settingsStore.saveSRSSettings(settingsStore.srsSettings)"
            />
          </div>
        </div>
      </div>

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

        <p v-if="jsonStatusMsg" class="text-xs text-indigo-400 mt-3 text-center">
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
              Estás usando Rubik BLD como aplicación instalada. Puedes abrirla directamente desde tu pantalla de inicio y utilizarla sin conexión en cualquier momento.
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
            class="w-full justify-center bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 shadow-indigo-600/30"
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
          Rubik BLD Flashcards es un proyecto de código abierto desarrollado para la comunidad de cuberos a ciegas (3BLD). Si deseas revisar el código, reportar un problema o hacer una aportación con nuevas funciones, ¡tu ayuda es muy bienvenida!
        </p>

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

        <div class="mt-4 pt-3 border-t border-dark-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>Licencia MIT • Vue 3 + Tailwind</span>
          <button
            type="button"
            class="flex items-center gap-1 text-indigo-400 hover:underline"
            @click="openGithubUrl(GITHUB_REPO_URL)"
          >
            <span>github.com/EDGAR-BRI/rubikbld</span>
            <AppIcon name="lucide:external-link" :size="12" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
