import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'
import { DEFAULT_SRS_SETTINGS, type SRSSettings } from '@/models/card'
import {
  type DriveSyncStatus,
  googleDriveService,
} from '@/services/googleDrive'

export const useSettingsStore = defineStore('settings', () => {
  const defaultClientId =
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
    '142729865983-vorbrki0frhrivbrsi3ga5tnnvc1ssaj.apps.googleusercontent.com'
  const srsSettings = ref<SRSSettings>({ ...DEFAULT_SRS_SETTINGS })
  const practiceOnlyCompleted = ref(true) // Solo practicar pares que ya tienen palabra configurada
  const reversePractice = ref(false) // Ver imagen/palabra primero y adivinar el par
  const googleClientId = ref<string>(defaultClientId)
  
  // Gestos táctiles de deslizamiento en tarjetas
  const enableCardGestures = ref(true)
  const allowSwipeBeforeFlip = ref(true)
  const gestureSensitivity = ref<'normal' | 'high' | 'low'>('normal')
  
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
    if (gClientId?.value && typeof gClientId.value === 'string' && gClientId.value.trim().length > 0) {
      googleClientId.value = gClientId.value.trim()
    } else if (defaultClientId) {
      googleClientId.value = defaultClientId
    }

    const onlyComp = await db.settings.get('practice_only_completed')
    if (onlyComp !== undefined) {
      practiceOnlyCompleted.value = onlyComp.value
    }

    const rev = await db.settings.get('reverse_practice')
    if (rev !== undefined) {
      reversePractice.value = rev.value
    }

    const gestures = await db.settings.get('enable_card_gestures')
    if (gestures !== undefined) {
      enableCardGestures.value = gestures.value
    }

    const swipeBefore = await db.settings.get('allow_swipe_before_flip')
    if (swipeBefore !== undefined) {
      allowSwipeBeforeFlip.value = swipeBefore.value
    }

    const sensitivity = await db.settings.get('gesture_sensitivity')
    if (sensitivity?.value) {
      gestureSensitivity.value = sensitivity.value
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

  async function setEnableCardGestures(val: boolean) {
    enableCardGestures.value = val
    await db.settings.put({ key: 'enable_card_gestures', value: val })
  }

  async function setAllowSwipeBeforeFlip(val: boolean) {
    allowSwipeBeforeFlip.value = val
    await db.settings.put({ key: 'allow_swipe_before_flip', value: val })
  }

  async function setGestureSensitivity(val: 'normal' | 'high' | 'low') {
    gestureSensitivity.value = val
    await db.settings.put({ key: 'gesture_sensitivity', value: val })
  }

  async function saveGoogleClientId(clientId: string) {
    googleClientId.value = clientId.trim()
    await db.settings.put({ key: 'google_client_id', value: googleClientId.value })
  }

  async function signInWithGoogle() {
    const effectiveClientId = googleClientId.value.trim() || defaultClientId
    if (!effectiveClientId) {
      syncStatus.value.error = 'Por favor ingresa tu Google Client ID en Ajustes'
      return
    }

    if (!googleClientId.value) {
      googleClientId.value = effectiveClientId
    }

    syncStatus.value.error = null
    try {
      await googleDriveService.initClient(effectiveClientId)
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

  async function signOutFromGoogle() {
    googleDriveService.signOut()
    syncStatus.value.isSignedIn = false
    syncStatus.value.user = null
    syncStatus.value.error = null
  }

  async function exportToDrive() {
    return syncWithDrive()
  }

  async function importFromDrive() {
    return restoreFromDrive()
  }

  return {
    srsSettings,
    practiceOnlyCompleted,
    reversePractice,
    googleClientId,
    enableCardGestures,
    allowSwipeBeforeFlip,
    gestureSensitivity,
    syncStatus,
    loadSettings,
    saveSRSSettings,
    setPracticeOnlyCompleted,
    setReversePractice,
    setEnableCardGestures,
    setAllowSwipeBeforeFlip,
    setGestureSensitivity,
    saveGoogleClientId,
    signInWithGoogle,
    signOutFromGoogle,
    syncWithDrive,
    restoreFromDrive,
    exportToDrive,
    importFromDrive,
  }
})
