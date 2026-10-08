import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'
import { DEFAULT_SRS_SETTINGS, type SRSSettings } from '@/models/card'
import {
  type DriveSyncStatus,
  googleDriveService,
} from '@/services/googleDrive'

export const useSettingsStore = defineStore('settings', () => {
  const srsSettings = ref<SRSSettings>({ ...DEFAULT_SRS_SETTINGS })
  const practiceOnlyCompleted = ref(true) // Solo practicar pares que ya tienen palabra configurada
  const reversePractice = ref(false) // Ver imagen/palabra primero y adivinar el par
  const googleClientId = ref<string>('')
  
  const syncStatus = ref<DriveSyncStatus>({
    isSignedIn: false,
    isSyncing: false,
    lastSyncTime: null,
    user: null,
    error: null,
  })

  async function loadSettings() {
    const srs = await db.settings.get('srs_settings')
    if (srs?.value) {
      srsSettings.value = { ...DEFAULT_SRS_SETTINGS, ...srs.value }
    }

    const gClientId = await db.settings.get('google_client_id')
    if (gClientId?.value) {
      googleClientId.value = gClientId.value
    }

    const onlyComp = await db.settings.get('practice_only_completed')
    if (onlyComp !== undefined) {
      practiceOnlyCompleted.value = onlyComp.value
    }

    const rev = await db.settings.get('reverse_practice')
    if (rev !== undefined) {
      reversePractice.value = rev.value
    }

    const lastSync = await db.settings.get('last_drive_sync')
    if (lastSync?.value) {
      syncStatus.value.lastSyncTime = lastSync.value
    }
  }

  async function saveSRSSettings(newSettings: SRSSettings) {
    srsSettings.value = newSettings
    await db.settings.put({ key: 'srs_settings', value: newSettings })
  }

  async function setPracticeOnlyCompleted(val: boolean) {
    practiceOnlyCompleted.value = val
    await db.settings.put({ key: 'practice_only_completed', value: val })
  }

  async function setReversePractice(val: boolean) {
    reversePractice.value = val
    await db.settings.put({ key: 'reverse_practice', value: val })
  }

  async function saveGoogleClientId(clientId: string) {
    googleClientId.value = clientId.trim()
    await db.settings.put({ key: 'google_client_id', value: googleClientId.value })
  }

  async function signInWithGoogle() {
    if (!googleClientId.value) {
      syncStatus.value.error = 'Por favor ingresa tu Google Client ID en Ajustes'
      return
    }

    syncStatus.value.error = null
    try {
      await googleDriveService.initClient(googleClientId.value)
      await googleDriveService.requestAccessToken()
      const user = await googleDriveService.fetchUserProfile()
      syncStatus.value.isSignedIn = true
      syncStatus.value.user = user
    } catch (err: any) {
      syncStatus.value.error = err.message || 'Error al conectar con Google'
    }
  }

  async function syncWithDrive() {
    if (!syncStatus.value.isSignedIn) {
      await signInWithGoogle()
      if (!syncStatus.value.isSignedIn) return
    }

    syncStatus.value.isSyncing = true
    syncStatus.value.error = null

    try {
      await googleDriveService.uploadBackupToDrive()
      const now = Date.now()
      syncStatus.value.lastSyncTime = now
      await db.settings.put({ key: 'last_drive_sync', value: now })
    } catch (err: any) {
      syncStatus.value.error = err.message || 'Error al sincronizar con Drive'
    } finally {
      syncStatus.value.isSyncing = false
    }
  }

  async function restoreFromDrive() {
    if (!syncStatus.value.isSignedIn) {
      await signInWithGoogle()
      if (!syncStatus.value.isSignedIn) return
    }

    syncStatus.value.isSyncing = true
    syncStatus.value.error = null

    try {
      const restored = await googleDriveService.downloadBackupFromDrive()
      if (restored) {
        const now = Date.now()
        syncStatus.value.lastSyncTime = now
        await db.settings.put({ key: 'last_drive_sync', value: now })
      } else {
        syncStatus.value.error = 'No se encontró archivo de respaldo en tu Drive'
      }
    } catch (err: any) {
      syncStatus.value.error = err.message || 'Error al restaurar desde Drive'
    } finally {
      syncStatus.value.isSyncing = false
    }
  }

  return {
    srsSettings,
    practiceOnlyCompleted,
    reversePractice,
    googleClientId,
    syncStatus,
    loadSettings,
    saveSRSSettings,
    setPracticeOnlyCompleted,
    setReversePractice,
    saveGoogleClientId,
    signInWithGoogle,
    syncWithDrive,
    restoreFromDrive,
  }
})
