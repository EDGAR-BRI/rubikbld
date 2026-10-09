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
  
  // Control por inclinación del dispositivo (DeviceOrientation / Giroscopio)
  const enableTiltGestures = ref(false)
  const tiltSensitivity = ref<'normal' | 'high' | 'low'>('normal')
  
  const syncStatus = ref<DriveSyncStatus>({
    isSignedIn: false,
    isSyncing: false,
    lastSyncTime: null,
    user: null,
    error: null,
  })

  // Sincronización automática con Google Drive al reconectarse a internet
  const autoSyncDrive = ref(true)

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

    const tilt = await db.settings.get('enable_tilt_gestures')
    if (tilt !== undefined) {
      enableTiltGestures.value = tilt.value
    }

    const tSens = await db.settings.get('tilt_sensitivity')
    if (tSens?.value) {
      tiltSensitivity.value = tSens.value
    }

    const lastSync = await db.settings.get('last_drive_sync')
    if (lastSync?.value) {
      syncStatus.value.lastSyncTime = lastSync.value
    }

    const autoSync = await db.settings.get('auto_sync_drive')
    if (autoSync !== undefined) {
      autoSyncDrive.value = autoSync.value
    }

    // Restaurar estado de conexión persistente de Google
    const isConnected = await db.settings.get('google_is_connected')
    const savedUser = await db.settings.get('google_user_profile')
    const savedToken = await db.settings.get('google_access_token')
    const tokenExpiresAt = await db.settings.get('google_token_expires_at')

    if (isConnected?.value) {
      syncStatus.value.isSignedIn = true
      if (savedUser?.value) {
        syncStatus.value.user = savedUser.value
      }

      const now = Date.now()
      // Si el token aún es válido por al menos 60 segundos
      if (savedToken?.value && tokenExpiresAt?.value && tokenExpiresAt.value > now + 60000) {
        googleDriveService.setAccessToken(savedToken.value)
      } else if (navigator.onLine) {
        // Token vencido o ausente pero estamos online: renovar silenciosamente en segundo plano
        silentRefreshGoogleToken().catch(() => {})
      }
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

  async function setEnableTiltGestures(val: boolean) {
    enableTiltGestures.value = val
    await db.settings.put({ key: 'enable_tilt_gestures', value: val })
  }

  async function setTiltSensitivity(val: 'normal' | 'high' | 'low') {
    tiltSensitivity.value = val
    await db.settings.put({ key: 'tilt_sensitivity', value: val })
  }

  async function saveGoogleClientId(clientId: string) {
    googleClientId.value = clientId.trim()
    await db.settings.put({ key: 'google_client_id', value: googleClientId.value })
  }

  async function setAutoSyncDrive(val: boolean) {
    autoSyncDrive.value = val
    await db.settings.put({ key: 'auto_sync_drive', value: val })
  }

  /**
   * Intenta renovar el token de Google silenciosamente en segundo plano sin desplegar modales
   */
  async function silentRefreshGoogleToken(): Promise<boolean> {
    const effectiveClientId = googleClientId.value.trim() || defaultClientId
    if (!effectiveClientId || !navigator.onLine) return false

    try {
      await googleDriveService.initClient(effectiveClientId)
      const tokenResult = await googleDriveService.requestAccessToken({ prompt: '' })
      const expiresAt = Date.now() + (tokenResult.expiresIn || 3600) * 1000

      await db.settings.put({ key: 'google_access_token', value: tokenResult.accessToken })
      await db.settings.put({ key: 'google_token_expires_at', value: expiresAt })
      await db.settings.put({ key: 'google_is_connected', value: true })

      if (!syncStatus.value.user) {
        const user = await googleDriveService.fetchUserProfile()
        if (user) {
          syncStatus.value.user = user
          await db.settings.put({ key: 'google_user_profile', value: user })
        }
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Inicia sesión interactiva con Google y guarda el perfil y credenciales
   */
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
      const tokenResult = await googleDriveService.requestAccessToken({ prompt: 'consent' })
      const expiresAt = Date.now() + (tokenResult.expiresIn || 3600) * 1000

      await db.settings.put({ key: 'google_access_token', value: tokenResult.accessToken })
      await db.settings.put({ key: 'google_token_expires_at', value: expiresAt })
      await db.settings.put({ key: 'google_is_connected', value: true })

      const user = await googleDriveService.fetchUserProfile()
      syncStatus.value.isSignedIn = true
      if (user) {
        syncStatus.value.user = user
        await db.settings.put({ key: 'google_user_profile', value: user })
      }
    } catch (err: any) {
      syncStatus.value.error = err.message || 'Error al conectar con Google'
      throw err
    }
  }

  /**
   * Asegura que exista un token de acceso válido antes de operaciones de Drive
   * @param interactive Si es false (ej. sync automático en segundo plano), no abre modales
   */
  async function ensureActiveToken(interactive = true): Promise<boolean> {
    const isConnected = await db.settings.get('google_is_connected')
    if (!isConnected?.value && !syncStatus.value.isSignedIn) {
      if (!interactive) return false
      try {
        await signInWithGoogle()
        return syncStatus.value.isSignedIn
      } catch {
        return false
      }
    }

    const tokenExpiresAt = await db.settings.get('google_token_expires_at')
    const savedToken = await db.settings.get('google_access_token')
    const now = Date.now()

    if (savedToken?.value && tokenExpiresAt?.value && tokenExpiresAt.value > now + 60000) {
      googleDriveService.setAccessToken(savedToken.value)
      return true
    }

    // Token caducado o ausente: intentar renovación silenciosa
    const refreshed = await silentRefreshGoogleToken()
    if (refreshed) return true

    // Si falló la renovación silenciosa y se permite interacción
    if (interactive && navigator.onLine) {
      try {
        await signInWithGoogle()
        return syncStatus.value.isSignedIn
      } catch {
        return false
      }
    }

    if (interactive) {
      syncStatus.value.error = 'Sin conexión para contactar a Google Drive'
    }
    return false
  }

  async function syncWithDrive(interactive = true): Promise<boolean> {
    const hasToken = await ensureActiveToken(interactive)
    if (!hasToken) return false

    syncStatus.value.isSyncing = true
    syncStatus.value.error = null

    try {
      await googleDriveService.uploadBackupToDrive()
      const now = Date.now()
      syncStatus.value.lastSyncTime = now
      await db.settings.put({ key: 'last_drive_sync', value: now })
      return true
    } catch (err: any) {
      if (interactive) {
        syncStatus.value.error = err.message || 'Error al sincronizar con Drive'
      }
      return false
    } finally {
      syncStatus.value.isSyncing = false
    }
  }

  async function restoreFromDrive() {
    const hasToken = await ensureActiveToken()
    if (!hasToken) return

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

    await db.settings.delete('google_user_profile')
    await db.settings.delete('google_access_token')
    await db.settings.delete('google_token_expires_at')
    await db.settings.delete('google_is_connected')
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
    enableTiltGestures,
    tiltSensitivity,
    autoSyncDrive,
    syncStatus,
    loadSettings,
    saveSRSSettings,
    setPracticeOnlyCompleted,
    setReversePractice,
    setEnableCardGestures,
    setAllowSwipeBeforeFlip,
    setGestureSensitivity,
    setEnableTiltGestures,
    setTiltSensitivity,
    setAutoSyncDrive,
    saveGoogleClientId,
    signInWithGoogle,
    silentRefreshGoogleToken,
    ensureActiveToken,
    signOutFromGoogle,
    syncWithDrive,
    restoreFromDrive,
    exportToDrive,
    importFromDrive,
  }
})
