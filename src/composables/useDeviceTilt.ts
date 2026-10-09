import { ref, computed, watch, onMounted, onUnmounted, type Ref } from 'vue'

export type TiltDirection = 'right' | 'left' | 'up' | 'down'
export type TiltSensitivity = 'normal' | 'high' | 'low'

export interface DeviceTiltOptions {
  enabled?: Ref<boolean> | (() => boolean)
  sensitivity?: Ref<TiltSensitivity> | (() => TiltSensitivity)
  holdDurationMs?: number
  onTrigger?: (direction: TiltDirection) => void
}

/**
 * Composable para control por inclinación del dispositivo (DeviceOrientation / Giroscopio).
 * Diseñado especialmente para cuberos BLD que usan el smartphone con una mano mientras
 * manipulan el cubo con la otra.
 */
export function useDeviceTilt(options: DeviceTiltOptions = {}) {
  const isSupported = ref(typeof window !== 'undefined' && 'DeviceOrientationEvent' in window)
  const hasPermission = ref(true)
  const isListening = ref(false)
  const isLocked = ref(false)

  // Grados absolutos crudos
  const rawBeta = ref(0)
  const rawGamma = ref(0)

  // Grados suavizados con filtro paso-bajo (Lerp) para evitar temblores
  const smoothBeta = ref(45)
  const smoothGamma = ref(0)

  // Línea de base (posición neutral de descanso de la mano)
  const baselineBeta = ref<number | null>(null)
  const baselineGamma = ref<number | null>(null)

  // Diferencia respecto a la posición neutra
  const deltaX = ref(0)
  const deltaY = ref(0)

  // Temporizador de sostenimiento para evitar disparos accidentales
  let holdTimer: number | null = null
  let cooldownTimer: number | null = null
  let isCalibrated = false

  const isEnabled = computed(() => {
    if (!options.enabled) return true
    return typeof options.enabled === 'function' ? options.enabled() : options.enabled.value
  })

  const sensitivity = computed<TiltSensitivity>(() => {
    if (!options.sensitivity) return 'normal'
    return typeof options.sensitivity === 'function' ? options.sensitivity() : options.sensitivity.value
  })

  // Umbrales angulares según sensibilidad seleccionada
  const angularThresholds = computed(() => {
    switch (sensitivity.value) {
      case 'high':
        return { x: 15, y: 17 } // Muy sensible, requiere poco giro
      case 'low':
        return { x: 30, y: 32 } // Firme y deliberado
      case 'normal':
      default:
        return { x: 22, y: 24 } // Equilibrado
    }
  })

  // Progreso hacia el umbral de disparo [0, 1.25]
  const progress = computed(() => {
    const { x, y } = angularThresholds.value
    const normX = Math.abs(deltaX.value) / x
    const normY = Math.abs(deltaY.value) / y
    return Math.min(Math.hypot(normX, normY), 1.3)
  })

  // Dirección dominante activa
  const activeDirection = computed<TiltDirection | null>(() => {
    if (progress.value < 0.25) return null

    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)

    if (absX >= absY) {
      return deltaX.value > 0 ? 'right' : 'left'
    } else {
      // deltaY < 0 es inclinación hacia adelante (arriba); deltaY > 0 hacia el usuario (abajo)
      return deltaY.value < 0 ? 'up' : 'down'
    }
  })

  // ¿Ha superado el umbral para disparar?
  const isPastThreshold = computed(() => progress.value >= 1.0 && !isLocked.value)

  /**
   * Solicita permisos en iOS 13+ (DeviceOrientationEvent.requestPermission)
   */
  async function requestPermission(): Promise<boolean> {
    if (typeof (DeviceOrientationEvent as any)?.requestPermission === 'function') {
      try {
        const response = await (DeviceOrientationEvent as any).requestPermission()
        const granted = response === 'granted'
        hasPermission.value = granted
        if (granted) {
          startListening()
        }
        return granted
      } catch (err) {
        console.error('Error solicitando permisos de orientación:', err)
        hasPermission.value = false
        return false
      }
    }
    hasPermission.value = true
    return true
  }

  /**
   * Calibra la posición neutra actual como el punto cero de reposo
   */
  function calibrate() {
    baselineBeta.value = smoothBeta.value
    baselineGamma.value = smoothGamma.value
    deltaX.value = 0
    deltaY.value = 0
    isLocked.value = false
    isCalibrated = true
    clearTimers()
  }

  function clearTimers() {
    if (holdTimer !== null) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
    if (cooldownTimer !== null) {
      clearTimeout(cooldownTimer)
      cooldownTimer = null
    }
  }

  /**
   * Bloquea temporalmente el sensor tras una calificación hasta que el teléfono vuelva al centro
   */
  function lockUntilNeutral(cooldownMs: number = 400) {
    isLocked.value = true
    clearTimers()

    cooldownTimer = window.setTimeout(() => {
      // El desbloqueo real ocurrirá en handleOrientation cuando vuelva a progress < 0.3
    }, cooldownMs)
  }

  function handleOrientation(event: DeviceOrientationEvent) {
    if (!isEnabled.value) return

    const beta = event.beta ?? 45 // Pitch: frente / atrás
    const gamma = event.gamma ?? 0 // Roll: izquierda / derecha

    rawBeta.value = beta
    rawGamma.value = gamma

    // Filtro paso-bajo suave (Lerp) para filtrar vibraciones de la mano
    smoothBeta.value += (beta - smoothBeta.value) * 0.35
    smoothGamma.value += (gamma - smoothGamma.value) * 0.35

    // Primera calibración automática en reposo
    if (!isCalibrated || baselineBeta.value === null || baselineGamma.value === null) {
      baselineBeta.value = smoothBeta.value
      baselineGamma.value = smoothGamma.value
      isCalibrated = true
    }

    // Calcular desviación relativa respecto a la posición neutra
    deltaX.value = smoothGamma.value - (baselineGamma.value || 0)
    deltaY.value = smoothBeta.value - (baselineBeta.value || 45)

    // Si estaba bloqueado, verificar si regresó a la zona neutral para desbloquear
    if (isLocked.value) {
      if (progress.value < 0.3) {
        isLocked.value = false
      }
      return
    }

    // Comprobación de disparo deliberado
    if (isPastThreshold.value && activeDirection.value) {
      if (holdTimer === null) {
        const holdMs = options.holdDurationMs ?? 240
        const triggerDir = activeDirection.value

        holdTimer = window.setTimeout(() => {
          if (isPastThreshold.value && activeDirection.value === triggerDir && !isLocked.value) {
            // Vibración háptica de confirmación si está soportada
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              try {
                navigator.vibrate(45)
              } catch (_) {}
            }

            options.onTrigger?.(triggerDir)
            lockUntilNeutral(500)
          }
          holdTimer = null
        }, holdMs)
      }
    } else {
      if (holdTimer !== null) {
        clearTimeout(holdTimer)
        holdTimer = null
      }
    }
  }

  function startListening() {
    if (isListening.value || typeof window === 'undefined') return
    window.addEventListener('deviceorientation', handleOrientation, { passive: true })
    isListening.value = true
    isCalibrated = false
  }

  function stopListening() {
    if (!isListening.value || typeof window === 'undefined') return
    window.removeEventListener('deviceorientation', handleOrientation)
    isListening.value = false
    clearTimers()
  }

  watch(
    () => isEnabled.value,
    (enabled) => {
      if (enabled && hasPermission.value) {
        startListening()
      } else if (!enabled) {
        stopListening()
      }
    },
    { immediate: true },
  )

  onMounted(() => {
    if (isEnabled.value && hasPermission.value) {
      startListening()
    }
  })

  onUnmounted(() => {
    stopListening()
  })

  return {
    isSupported,
    hasPermission,
    isListening,
    isLocked,
    rawBeta,
    rawGamma,
    smoothBeta,
    smoothGamma,
    deltaX,
    deltaY,
    progress,
    activeDirection,
    isPastThreshold,
    requestPermission,
    calibrate,
    lockUntilNeutral,
    startListening,
    stopListening,
  }
}
