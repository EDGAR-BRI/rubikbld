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
  let hasNavigated = false

  function safeReloadToRoot() {
    if (hasNavigated) return
    hasNavigated = true
    if (typeof window !== 'undefined') {
      // Redirigir siempre a la raíz con timestamp para evitar caché HTTP en index.html
      // y prevenir errores de navegación directa a subrutas SPA como /settings
      window.location.replace(`${window.location.origin}/?v=${Date.now()}`)
    }
  }

  // Escuchar si un nuevo Service Worker toma control mientras la búsqueda está activa
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isCheckingUpdate.value) {
        updateStatusText.value = '¡Actualización lista!'
        updateDetailText.value = 'Reiniciando aplicación con la nueva versión...'
        setTimeout(() => {
          safeReloadToRoot()
        }, 600)
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
    updateDetailText.value = 'Verificando con el repositorio y el Service Worker...'

    // Duración mínima de 1.8s para que la animación del cubo 3D se aprecie de forma fluida
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1800))

    try {
      // 1. Verificación remota en GitHub (package.json en main)
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
          // Si falla GitHub (bloqueo, rate limit o timeout), no bloquea la app
        }
        return null
      })()

      // 2. Verificación con el Service Worker local
      const swPromise = (async (): Promise<{
        hasUpdate: boolean
        waitingWorker: ServiceWorker | null
        installingWorker: ServiceWorker | null
        registration: ServiceWorkerRegistration | null
      }> => {
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
          return { hasUpdate: false, waitingWorker: null, installingWorker: null, registration: null }
        }

        try {
          const reg = await navigator.serviceWorker.getRegistration()
          if (!reg) {
            return { hasUpdate: false, waitingWorker: null, installingWorker: null, registration: null }
          }

          // Si ya existe un worker descargado en espera
          if (reg.waiting) {
            return { hasUpdate: true, waitingWorker: reg.waiting, installingWorker: null, registration: reg }
          }

          return await new Promise((resolve) => {
            let settled = false
            const timer = setTimeout(() => {
              if (!settled) {
                settled = true
                resolve({
                  hasUpdate: false,
                  waitingWorker: null,
                  installingWorker: null,
                  registration: reg,
                })
              }
            }, 3500)

            const onUpdateFound = () => {
              const worker = reg.installing
              if (!worker) return

              updateStatusText.value = 'Descargando actualización...'
              updateDetailText.value = 'Obteniendo los archivos más recientes de Memo Cube...'

              worker.addEventListener('statechange', () => {
                if (worker.state === 'installed') {
                  if (!settled) {
                    settled = true
                    clearTimeout(timer)
                    resolve({
                      hasUpdate: true,
                      waitingWorker: reg.waiting || worker,
                      installingWorker: worker,
                      registration: reg,
                    })
                  }
                }
              })
            }

            reg.addEventListener('updatefound', onUpdateFound, { once: true })

            reg.update().catch(() => {
              if (!settled) {
                settled = true
                clearTimeout(timer)
                resolve({
                  hasUpdate: false,
                  waitingWorker: null,
                  installingWorker: null,
                  registration: reg,
                })
              }
            })
          })
        } catch (err) {
          console.warn('Advertencia comprobando Service Worker:', err)
          return { hasUpdate: false, waitingWorker: null, installingWorker: null, registration: null }
        }
      })()

      const [remoteVersion, swResult] = await Promise.all([remotePromise, swPromise])
      await minDelay

      const hasRemoteUpdate = !!(remoteVersion && isNewerVersion(remoteVersion, APP_VERSION))
      const hasSwUpdate = swResult.hasUpdate

      if (hasSwUpdate && (swResult.waitingWorker || swResult.installingWorker)) {
        // CASO A: El Service Worker ya descargó o terminó de instalar la nueva versión
        updateStatusText.value = remoteVersion
          ? `¡Nueva versión v${remoteVersion} lista!`
          : '¡Actualización descargada!'
        updateDetailText.value = 'Activando cambios y reiniciando aplicación...'

        const targetWorker = swResult.waitingWorker || swResult.installingWorker
        targetWorker?.postMessage({ type: 'SKIP_WAITING' })

        // Timeout de seguridad en caso de que controllerchange no se dispare
        setTimeout(() => {
          safeReloadToRoot()
        }, 1500)
      } else if (hasRemoteUpdate) {
        // CASO B: Hay una versión más nueva en GitHub pero el Service Worker local no la detectó
        // (ej. caché de SW obsoleta o desfasada en el cliente).
        // Desregistramos limpiamente el Service Worker viejo y limpiamos caché sin corromper el runtime.
        updateStatusText.value = `¡Nueva versión v${remoteVersion} disponible!`
        updateDetailText.value = 'Sincronizando con el servidor y actualizando...'

        if (swResult.registration) {
          try {
            await swResult.registration.unregister()
          } catch {}
        }

        if (typeof window !== 'undefined' && 'caches' in window) {
          try {
            const keys = await caches.keys()
            await Promise.all(keys.map((k) => caches.delete(k)))
          } catch {}
        }

        await new Promise((resolve) => setTimeout(resolve, 800))
        safeReloadToRoot()
      } else {
        // CASO C: La aplicación ya está al día
        updateStatusText.value = '¡Memo Cube está al día!'
        updateDetailText.value = `Tienes la versión más reciente (v${APP_VERSION}).`

        await new Promise((resolve) => setTimeout(resolve, 1000))
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
