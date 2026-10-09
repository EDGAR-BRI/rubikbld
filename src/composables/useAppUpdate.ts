import { ref } from 'vue'
import { APP_VERSION } from '@/config/version'
import { showSuccessToast, showWarningToast, showErrorToast } from '@/utils/alerts'

/**
 * Compara dos cadenas de versión semántica (ej. "0.12.0" vs "0.13.0").
 * Devuelve true si remoteVersion es estrictamente mayor que currentVersion.
 */
export function isNewerVersion(remoteVersion: string, currentVersion: string): boolean {
  const clean = (v: string) => v.replace(/^v/, '').trim()
  const rParts = clean(remoteVersion).split('.').map((n) => parseInt(n, 10) || 0)
  const cParts = clean(currentVersion).split('.').map((n) => parseInt(n, 10) || 0)
  const len = Math.max(rParts.length, cParts.length)

  for (let i = 0; i < len; i++) {
    const r = rParts[i] ?? 0
    const c = cParts[i] ?? 0
    if (r > c) return true
    if (r < c) return false
  }

  return false
}

export function useAppUpdate() {
  const isCheckingUpdate = ref(false)
  const updateStatusText = ref('Buscando actualizaciones...')
  const updateDetailText = ref('Comprobando si hay una nueva versión disponible...')

  // Escuchar si el Service Worker toma control mientras la app está viva
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isCheckingUpdate.value) {
        window.location.reload()
      }
    })
  }

  async function checkForUpdates(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showWarningToast(
        'Modo sin conexión',
        'Necesitas conexión a internet para verificar y descargar actualizaciones.',
      )
      return
    }

    isCheckingUpdate.value = true
    updateStatusText.value = 'Buscando actualizaciones...'
    updateDetailText.value = 'Verificando con el Service Worker y el repositorio...'

    // Aseguramos una duración mínima de 2s para que el usuario aprecie el loader 3D del cubo
    const minDelay = new Promise((resolve) => setTimeout(resolve, 2000))

    try {
      let updateFound = false
      let newVersionTag: string | null = null

      // 1. Verificación en Service Worker (PWA)
      const swPromise = (async (): Promise<boolean> => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
          return false
        }

        try {
          const reg = await navigator.serviceWorker.getRegistration()
          if (!reg) return false

          // Si ya existe un worker descargado en espera
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' })
            return true
          }

          return await new Promise<boolean>((resolve) => {
            let resolved = false
            const timeout = setTimeout(() => {
              if (!resolved) {
                resolved = true
                resolve(false)
              }
            }, 3500)

            const onUpdateFound = () => {
              const installingWorker = reg.installing
              if (!installingWorker) return

              updateStatusText.value = 'Descargando actualización...'
              updateDetailText.value = 'Obteniendo los archivos más recientes de Memo Cube...'

              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed') {
                  if (!resolved) {
                    resolved = true
                    clearTimeout(timeout)
                    resolve(true)
                  }
                }
              })
            }

            reg.addEventListener('updatefound', onUpdateFound, { once: true })

            reg.update().catch(() => {
              if (!resolved) {
                resolved = true
                clearTimeout(timeout)
                resolve(false)
              }
            })
          })
        } catch (err) {
          console.warn('Advertencia comprobando Service Worker:', err)
          return false
        }
      })()

      // 2. Verificación remota en GitHub (package.json en main)
      const remotePromise = (async (): Promise<string | null> => {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 4000)

          const res = await fetch(
            `https://raw.githubusercontent.com/EDGAR-BRI/rubikbld/main/package.json?t=${Date.now()}`,
            {
              cache: 'no-store',
              signal: controller.signal,
            },
          )
          clearTimeout(timeoutId)

          if (res.ok) {
            const data = await res.json()
            if (data?.version && typeof data.version === 'string') {
              return data.version.trim()
            }
          }
        } catch {
          // Si falla GitHub (bloqueo o rate limit), no interrumpe el flujo de la app
        }
        return null
      })()

      const [swUpdated, remoteVersion] = await Promise.all([swPromise, remotePromise])
      await minDelay

      if (remoteVersion && isNewerVersion(remoteVersion, APP_VERSION)) {
        updateFound = true
        newVersionTag = remoteVersion
      } else if (swUpdated) {
        updateFound = true
      }

      if (updateFound) {
        updateStatusText.value = newVersionTag
          ? `¡Nueva versión v${newVersionTag} disponible!`
          : '¡Actualización encontrada!'
        updateDetailText.value = 'Aplicando cambios y reiniciando aplicación...'

        // Limpiar cachés del navegador para evitar assets obsoletos
        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            const keys = await caches.keys()
            await Promise.all(keys.map((k) => caches.delete(k)))
          } catch {}
        }

        // Breve pausa para que el usuario lea la confirmación
        await new Promise((resolve) => setTimeout(resolve, 1400))
        window.location.reload()
      } else {
        updateStatusText.value = '¡Memo Cube está al día!'
        updateDetailText.value = `Tienes la versión más reciente (v${APP_VERSION}).`

        await new Promise((resolve) => setTimeout(resolve, 1200))
        isCheckingUpdate.value = false

        showSuccessToast(
          '¡Estás al día!',
          `Memo Cube v${APP_VERSION} es la versión más reciente.`,
          3500,
        )
      }
    } catch (err: any) {
      console.error('Error buscando actualizaciones:', err)
      await minDelay
      isCheckingUpdate.value = false
      showErrorToast(
        'Error de actualización',
        err?.message || 'No se pudo conectar con el servidor para buscar actualizaciones.',
      )
    }
  }

  return {
    isCheckingUpdate,
    updateStatusText,
    updateDetailText,
    currentVersion: APP_VERSION,
    checkForUpdates,
  }
}
