import { ref, computed } from 'vue'

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

// Estado singleton compartido a nivel de módulo
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const isInstalled = ref<boolean>(false)
const isInstallSupported = ref<boolean>(false)

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  )
}

function checkIsIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// Inicialización de escuchas de eventos PWA
if (typeof window !== 'undefined') {
  isInstalled.value = checkIsStandalone()

  window.addEventListener('beforeinstallprompt', (e) => {
    // Evitar que el navegador muestre su mini-infobar automáticamente
    e.preventDefault()
    deferredPrompt.value = e as BeforeInstallPromptEvent
    isInstallSupported.value = true
  })

  window.addEventListener('appinstalled', () => {
    isInstalled.value = true
    deferredPrompt.value = null
  })

  // Escuchar cambios de display-mode si el navegador lo soporta
  try {
    const mediaQuery = window.matchMedia('(display-mode: standalone)')
    mediaQuery.addEventListener?.('change', (e) => {
      if (e.matches) {
        isInstalled.value = true
      }
    })
  } catch {
    // Silently ignore older browsers
  }
}

export function usePwaInstall() {
  const isIOS = checkIsIOS()
  const canInstall = computed(() => !isInstalled.value && !!deferredPrompt.value)

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'manual' | 'already-installed'> {
    if (isInstalled.value) {
      return 'already-installed'
    }

    if (deferredPrompt.value) {
      try {
        const promptEvent = deferredPrompt.value
        await promptEvent.prompt()
        const choiceResult = await promptEvent.userChoice
        if (choiceResult.outcome === 'accepted') {
          deferredPrompt.value = null
          isInstalled.value = true
          return 'accepted'
        }
        return 'dismissed'
      } catch (err) {
        console.error('Error al lanzar prompt de instalación:', err)
        return 'manual'
      }
    }

    return 'manual'
  }

  return {
    deferredPrompt,
    isInstalled,
    canInstall,
    isInstallSupported,
    isIOS,
    promptInstall,
  }
}
