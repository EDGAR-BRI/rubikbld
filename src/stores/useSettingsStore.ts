import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db'
import { DEFAULT_SRS_SETTINGS, type SRSSettings } from '@/models/card'
import {
  type DriveSyncStatus,
  GoogleAuthExpiredError,
  googleDriveService,
} from '@/services/googleDrive'

export const useSettingsStore = defineStore('settings', () => {
  const defaultClientId =
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
    '142729865983-vorbrki0frhrivbrsi3ga5tnnvc1ssaj.apps.googleusercontent.com'
  const srsSettings = ref<SRSSettings>({ ...DEFAULT_SRS_SETTINGS })
  const practiceOnlyCompleted = ref(true) // Solo practicar pares que ya tienen palabra configurada
  const reversePractice = ref(false) // Ver imagen/palabra primero y adivinar el par
  const bldMemoOrder = ref<'edges_first' | 'corners_first'>('edges_first') // Orden de memorización y trazado 3BLD
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

  // Estado del token temporal (1 hora) en memoria sin abrir popups al iniciar la app
  const tokenExpiresAt = ref<number>(0)
  const hasActiveGoogleToken = ref(false)
  const isLoaded = ref(false)
  let loadingPromise: Promise<void> | null = null

  function refreshTokenValidityState(): boolean {
    const valid =
      !!googleDriveService.getAccessToken() &&
      tokenExpiresAt.value > Date.now() + 60000
    hasActiveGoogleToken.value = valid
    if (!valid) {
      googleDriveService.setAccessToken(null)
    }
    return valid
  }

  function preloadGoogleClient(): void {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    const effectiveClientId = googleClientId.value.trim() || defaultClientId
    if (!effectiveClientId) return
    googleDriveService.initClient(effectiveClientId).catch(() => {})
  }

  async function loadSettings(force = false) {
    if (!force && isLoaded.value) {
      refreshTokenValidityState()
      return
    }
    if (!force && loadingPromise) {
      return loadingPromise
    }

    loadingPromise = (async () => {
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

      const memoOrder = await db.settings.get('bld_memo_order')
      if (memoOrder?.value === 'edges_first' || memoOrder?.value === 'corners_first') {
        bldMemoOrder.value = memoOrder.value
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

      // Restaurar estado de conexión persistente de Google sin abrir popups al iniciar
      const isConnected = await db.settings.get('google_is_connected')
      const savedUser = await db.settings.get('google_user_profile')
      const savedToken = await db.settings.get('google_access_token')
      const savedTokenExpiresAt = await db.settings.get('google_token_expires_at')

      if (isConnected?.value) {
        syncStatus.value.isSignedIn = true
        if (savedUser?.value) {
          syncStatus.value.user = savedUser.value
        }

        const expiresAtVal =
          typeof savedTokenExpiresAt?.value === 'number' ? savedTokenExpiresAt.value : 0
        tokenExpiresAt.value = expiresAtVal

        if (savedToken?.value && expiresAtVal > Date.now() + 60000) {
          googleDriveService.setAccessToken(savedToken.value)
          hasActiveGoogleToken.value = true
        } else {
          googleDriveService.setAccessToken(null)
          hasActiveGoogleToken.value = false
        }

        preloadGoogleClient()
      }

      isLoaded.value = true
    })().finally(() => {
      loadingPromise = null
    })

    return loadingPromise
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

  async function setBldMemoOrder(order: 'edges_first' | 'corners_first') {
    bldMemoOrder.value = order
    await db.settings.put({ key: 'bld_memo_order', value: order })
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
    preloadGoogleClient()
  }

  async function setAutoSyncDrive(val: boolean) {
    autoSyncDrive.value = val
    await db.settings.put({ key: 'auto_sync_drive', value: val })
  }

  async function clearExpiredToken() {
    googleDriveService.setAccessToken(null)
    tokenExpiresAt.value = 0
    hasActiveGoogleToken.value = false
    await db.settings.delete('google_access_token')
    await db.settings.delete('google_token_expires_at')
  }

  /**
   * Inicia sesión o renueva el token de Google bajo demanda (siempre desde un clic del usuario)
   */
  async function signInWithGoogle(options?: { isReconnect?: boolean }) {
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
      if (!googleDriveService.isClientReady(effectiveClientId)) {
        await googleDriveService.initClient(effectiveClientId)
      }

      const userEmail = syncStatus.value.user?.email
      const isReconnect = Boolean(options?.isReconnect && userEmail)
      const tokenResult = await googleDriveService.requestAccessToken({
        prompt: isReconnect ? '' : 'select_account',
        loginHint: isReconnect ? userEmail : undefined,
      })

      const expiresAt = Date.now() + (tokenResult.expiresIn || 3600) * 1000
      tokenExpiresAt.value = expiresAt
      hasActiveGoogleToken.value = true
      syncStatus.value.isSignedIn = true

      await db.settings.put({ key: 'google_access_token', value: tokenResult.accessToken })
      await db.settings.put({ key: 'google_token_expires_at', value: expiresAt })
      await db.settings.put({ key: 'google_is_connected', value: true })

      if (!syncStatus.value.user || !isReconnect) {
        const user = await googleDriveService.fetchUserProfile()
        if (user) {
          syncStatus.value.user = user
          await db.settings.put({ key: 'google_user_profile', value: user })
        }
      }
    } catch (err: any) {
      syncStatus.value.error = err.message || 'Error al conectar con Google'
      throw err
    }
  }

  /**
   * Renueva explícitamente el permiso temporal de Google desde un botón de usuario
   */
  async function reconnectGoogle(): Promise<boolean> {
    if (!navigator.onLine) {
      syncStatus.value.error = 'Sin conexión para contactar a Google Drive'
      return false
    }
    try {
      await signInWithGoogle({ isReconnect: true })
      return refreshTokenValidityState()
    } catch {
      return false
    }
  }

  /**
   * Asegura que exista un token de acceso válido antes de operaciones de Drive.
   * Si interactive es false (ej. sync automático en segundo plano), nunca abre popups.
   */
  async function ensureActiveToken(interactive = true): Promise<boolean> {
    if (refreshTokenValidityState()) {
      return true
    }

    if (!interactive) {
      return false
    }

    if (!navigator.onLine) {
      syncStatus.value.error = 'Sin conexión para contactar a Google Drive'
      return false
    }

    try {
      await signInWithGoogle({ isReconnect: syncStatus.value.isSignedIn })
      return refreshTokenValidityState()
    } catch {
      return false
    }
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
      if (err instanceof GoogleAuthExpiredError) {
        await clearExpiredToken()
      }
      if (interactive) {
        syncStatus.value.error = err.message || 'Error al sincronizar con Drive'
      }
      return false
    } finally {
      syncStatus.value.isSyncing = false
    }
  }

  async function restoreFromDrive(): Promise<boolean> {
    const hasToken = await ensureActiveToken(true)
    if (!hasToken) return false

    syncStatus.value.isSyncing = true
    syncStatus.value.error = null

    try {
      const restored = await googleDriveService.downloadBackupFromDrive()
      if (restored) {
        const now = Date.now()
        syncStatus.value.lastSyncTime = now
        await db.settings.put({ key: 'last_drive_sync', value: now })
        return true
      } else {
        syncStatus.value.error = 'No se encontró archivo de respaldo en tu Drive'
        return false
      }
    } catch (err: any) {
      if (err instanceof GoogleAuthExpiredError) {
        await clearExpiredToken()
      }
      syncStatus.value.error = err.message || 'Error al restaurar desde Drive'
      return false
    } finally {
      syncStatus.value.isSyncing = false
    }
  }

  async function signOutFromGoogle() {
    googleDriveService.signOut()
    tokenExpiresAt.value = 0
    hasActiveGoogleToken.value = false
    syncStatus.value.isSignedIn = false
    syncStatus.value.user = null
    syncStatus.value.error = null

    await db.settings.delete('google_user_profile')
    await db.settings.delete('google_access_token')
    await db.settings.delete('google_token_expires_at')
    await db.settings.delete('google_is_connected')
  }

  async function exportToDrive(): Promise<boolean> {
    return syncWithDrive(true)
  }

  async function importFromDrive(): Promise<boolean> {
    return restoreFromDrive()
  }

  return {
    srsSettings,
    practiceOnlyCompleted,
    reversePractice,
    bldMemoOrder,
    googleClientId,
    enableCardGestures,
    allowSwipeBeforeFlip,
    gestureSensitivity,
    enableTiltGestures,
    tiltSensitivity,
    autoSyncDrive,
    syncStatus,
    hasActiveGoogleToken,
    loadSettings,
    refreshTokenValidityState,
    preloadGoogleClient,
    saveSRSSettings,
    setPracticeOnlyCompleted,
    setReversePractice,
    setBldMemoOrder,
    setEnableCardGestures,
    setAllowSwipeBeforeFlip,
    setGestureSensitivity,
    setEnableTiltGestures,
    setTiltSensitivity,
    setAutoSyncDrive,
    saveGoogleClientId,
    signInWithGoogle,
    reconnectGoogle,
    ensureActiveToken,
    signOutFromGoogle,
    syncWithDrive,
    restoreFromDrive,
    exportToDrive,
    importFromDrive,
  }
})
