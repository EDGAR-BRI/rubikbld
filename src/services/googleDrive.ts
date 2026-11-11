// Sincronización Serverless con Google Drive API v3 (Directo Frontend)
import { db } from '@/db'

export interface GoogleUserProfile {
  email: string
  name: string
  picture: string
}

export interface DriveSyncStatus {
  isSignedIn: boolean
  isSyncing: boolean
  lastSyncTime: number | null
  user: GoogleUserProfile | null
  error: string | null
}

export class GoogleAuthExpiredError extends Error {
  readonly isAuthExpired = true
  constructor(message = 'Tu sesión temporal de Google expiró. Pulsa para renovarla con 1 clic.') {
    super(message)
    this.name = 'GoogleAuthExpiredError'
  }
}

const BACKUP_FILENAME = 'rubikbld_backup.json'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

class GoogleDriveService {
  private accessToken: string | null = null
  private tokenClient: any = null
  private initializedClientId: string | null = null
  private scriptLoadingPromise: Promise<void> | null = null
  private pendingTokenResolve: ((res: { accessToken: string; expiresIn: number }) => void) | null = null
  private pendingTokenReject: ((err: Error) => void) | null = null

  /**
   * Carga dinámicamente el SDK de Google Identity Services si no está presente
   */
  async loadGoogleScript(): Promise<void> {
    if ((window as any).google?.accounts?.oauth2) return
    if (this.scriptLoadingPromise) return this.scriptLoadingPromise

    this.scriptLoadingPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => {
          this.scriptLoadingPromise = null
          reject(new Error('No se pudo cargar el SDK de Google'))
        }, { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        this.scriptLoadingPromise = null
        reject(new Error('No se pudo cargar el SDK de Google'))
      }
      document.head.appendChild(script)
    })

    return this.scriptLoadingPromise
  }

  /**
   * Indica si el cliente OAuth2 ya está listo en memoria para usarse sincrónicamente al hacer clic
   */
  isClientReady(clientId?: string): boolean {
    if (!this.tokenClient) return false
    if (clientId && this.initializedClientId !== clientId) return false
    return true
  }

  private settlePendingTokenError(err: Error): void {
    const reject = this.pendingTokenReject
    this.pendingTokenResolve = null
    this.pendingTokenReject = null
    reject?.(err)
  }

  /**
   * Inicializa el cliente de token OAuth2 con el Client ID del usuario/app
   */
  async initClient(clientId: string): Promise<void> {
    if (this.tokenClient && this.initializedClientId === clientId) return

    await this.loadGoogleScript()
    const google = (window as any).google
    if (!google?.accounts?.oauth2) {
      throw new Error('El SDK de Google Identity no se inicializó correctamente')
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp: any) => {
        const resolve = this.pendingTokenResolve
        const reject = this.pendingTokenReject
        this.pendingTokenResolve = null
        this.pendingTokenReject = null

        if (resp?.error) {
          reject?.(new Error(resp.error_description || resp.error))
          return
        }

        if (!resp?.access_token) {
          reject?.(new Error('No se recibió un token de acceso válido de Google'))
          return
        }

        this.accessToken = resp.access_token
        const expiresIn =
          typeof resp.expires_in === 'number'
            ? resp.expires_in
            : parseInt(resp.expires_in, 10) || 3600

        resolve?.({
          accessToken: resp.access_token,
          expiresIn,
        })
      },
      error_callback: (err: { type?: string; message?: string }) => {
        let msg = err?.message || 'No se pudo completar la autenticación con Google'
        if (err?.type === 'popup_failed_to_open') {
          msg = 'El navegador bloqueó la ventana emergente de Google. Intenta pulsar el botón nuevamente.'
        } else if (err?.type === 'popup_closed') {
          msg = 'Se cerró la ventana de inicio de sesión de Google.'
        }
        this.settlePendingTokenError(new Error(msg))
      },
    })

    this.initializedClientId = clientId
  }

  /**
   * Establece manualmente el token de acceso (ej. restaurado desde almacenamiento)
   */
  setAccessToken(token: string | null): void {
    this.accessToken = token
  }

  /**
   * Obtiene el token de acceso actual en memoria
   */
  getAccessToken(): string | null {
    return this.accessToken
  }

  /**
   * Solicita token de acceso OAuth2. Debe invocarse desde una interacción del usuario
   * para que el navegador no bloquee el popup de Google Identity Services.
   */
  async requestAccessToken(options?: {
    prompt?: string
    loginHint?: string
  }): Promise<{ accessToken: string; expiresIn: number }> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('El cliente de Google no ha sido inicializado con un Client ID'))
        return
      }

      if (this.pendingTokenReject) {
        this.settlePendingTokenError(new Error('Se inició una nueva solicitud de sesión'))
      }

      this.pendingTokenResolve = resolve
      this.pendingTokenReject = reject

      const overrideConfig: Record<string, string> = {}
      if (options?.prompt !== undefined) {
        overrideConfig.prompt = options.prompt
      }
      if (options?.loginHint) {
        overrideConfig.login_hint = options.loginHint
      }

      try {
        this.tokenClient.requestAccessToken(overrideConfig)
      } catch (err: any) {
        this.settlePendingTokenError(
          new Error(err?.message || 'No se pudo abrir la ventana de autenticación de Google'),
        )
      }
    })
  }

  /**
   * Obtiene la información del perfil del usuario conectado
   */
  async fetchUserProfile(): Promise<GoogleUserProfile | null> {
    if (!this.accessToken) return null
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      })
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }

  /**
   * Cierra la sesión activa y revoca el token de acceso
   */
  signOut(): void {
    if (this.accessToken && (window as any).google?.accounts?.oauth2) {
      try {
        (window as any).google.accounts.oauth2.revoke(this.accessToken, () => {})
      } catch {}
    }
    this.accessToken = null
  }

  /**
   * Busca si ya existe un archivo de respaldo en Google Drive
   */
  private async findBackupFileId(): Promise<string | null> {
    if (!this.accessToken) throw new Error('No hay sesión activa')

    const q = encodeURIComponent(`name = '${BACKUP_FILENAME}' and trashed = false`)
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id, name, modifiedTime)`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    )

    if (res.status === 401) {
      this.accessToken = null
      throw new GoogleAuthExpiredError()
    }
    if (!res.ok) throw new Error('Error al consultar Google Drive')
    const data = await res.json()
    if (data.files && data.files.length > 0) {
      return data.files[0].id
    }
    return null
  }

  /**
   * Exporta toda la base de datos local a un payload JSON
   */
  async exportLocalData(): Promise<string> {
    const schemes = await db.schemes.toArray()
    const pairs = await db.pairs.toArray()
    const cards = await db.cards.toArray()
    const reviews = await db.reviews.toArray()
    const settings = await db.settings.toArray()

    const backup = {
      version: 1,
      timestamp: Date.now(),
      appName: 'Memo Cube',
      data: {
        schemes,
        pairs,
        cards,
        reviews,
        settings,
      },
    }

    return JSON.stringify(backup)
  }

  /**
   * Importa un payload JSON en la base de datos local
   */
  async importLocalData(jsonString: string): Promise<void> {
    const backup = JSON.parse(jsonString)
    if (!backup.data) throw new Error('Formato de respaldo inválido')

    const { schemes, pairs, cards, reviews, settings } = backup.data

    if (schemes?.length) await db.schemes.bulkPut(schemes)
    if (pairs?.length) await db.pairs.bulkPut(pairs)
    if (cards?.length) await db.cards.bulkPut(cards)
    if (reviews?.length) await db.reviews.bulkPut(reviews)
    if (settings?.length) await db.settings.bulkPut(settings)
  }

  /**
   * Sube o actualiza el archivo de respaldo en Google Drive
   */
  async uploadBackupToDrive(): Promise<void> {
    if (!this.accessToken) throw new Error('No has iniciado sesión con Google')

    const fileContent = await this.exportLocalData()
    const existingFileId = await this.findBackupFileId()

    if (existingFileId) {
      // Actualizar archivo existente
      const res = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: fileContent,
        },
      )
      if (res.status === 401) {
        this.accessToken = null
        throw new GoogleAuthExpiredError()
      }
      if (!res.ok) throw new Error('Error al actualizar el respaldo en Google Drive')
    } else {
      // Crear nuevo archivo multipart
      const metadata = {
        name: BACKUP_FILENAME,
        mimeType: 'application/json',
        description: 'Copia de seguridad de pares e imágenes de Memo Cube',
      }

      const boundary = 'foo_bar_baz'
      const delimiter = `\r\n--${boundary}\r\n`
      const closeDelim = `\r\n--${boundary}--`

      const multipartRequestBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        fileContent +
        closeDelim

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': `multipart/related; boundary=${boundary}`,
          },
          body: multipartRequestBody,
        },
      )

      if (res.status === 401) {
        this.accessToken = null
        throw new GoogleAuthExpiredError()
      }
      if (!res.ok) throw new Error('Error al crear el archivo en Google Drive')
    }
  }

  /**
   * Descarga y restaura el respaldo desde Google Drive
   */
  async downloadBackupFromDrive(): Promise<boolean> {
    if (!this.accessToken) throw new Error('No has iniciado sesión con Google')

    const fileId = await this.findBackupFileId()
    if (!fileId) return false // No hay respaldo aún

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    )

    if (res.status === 401) {
      this.accessToken = null
      throw new GoogleAuthExpiredError()
    }
    if (!res.ok) throw new Error('Error al descargar el respaldo de Google Drive')
    const content = await res.text()
    await this.importLocalData(content)
    return true
  }
}

export const googleDriveService = new GoogleDriveService()
