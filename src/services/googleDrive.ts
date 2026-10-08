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

const BACKUP_FILENAME = 'rubikbld_backup.json'
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

class GoogleDriveService {
  private accessToken: string | null = null
  private tokenClient: any = null

  /**
   * Carga dinámicamente el SDK de Google Identity Services si no está presente
   */
  async loadGoogleScript(): Promise<void> {
    if ((window as any).google?.accounts?.oauth2) return

    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('No se pudo cargar el SDK de Google'))
      document.head.appendChild(script)
    })
  }

  /**
   * Inicializa el cliente de token OAuth2 con el Client ID del usuario/app
   */
  async initClient(clientId: string): Promise<void> {
    await this.loadGoogleScript()
    const google = (window as any).google

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          throw new Error(tokenResponse.error)
        }
        this.accessToken = tokenResponse.access_token
      },
    })
  }

  /**
   * Solicita inicio de sesión interactivo y token de acceso
   */
  async requestAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        reject(new Error('El cliente de Google no ha sido inicializado con un Client ID'))
        return
      }

      this.tokenClient.callback = (resp: any) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error))
        } else {
          this.accessToken = resp.access_token
          resolve(resp.access_token)
        }
      }

      this.tokenClient.requestAccessToken({ prompt: 'consent' })
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
      appName: 'RubikBLD',
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
      if (!res.ok) throw new Error('Error al actualizar el respaldo en Google Drive')
    } else {
      // Crear nuevo archivo multipart
      const metadata = {
        name: BACKUP_FILENAME,
        mimeType: 'application/json',
        description: 'Copia de seguridad de pares e imágenes de Rubik BLD',
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

    if (!res.ok) throw new Error('Error al descargar el respaldo de Google Drive')
    const content = await res.text()
    await this.importLocalData(content)
    return true
  }
}

export const googleDriveService = new GoogleDriveService()
