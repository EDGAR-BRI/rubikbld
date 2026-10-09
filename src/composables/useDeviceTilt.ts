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
 * Composable para control por giroscopio con detección de gesto tipo "LÁTIGO" (Whip flick).
 * Diseñado especialmente para cuberos BLD que usan el smartphone con una mano mientras
 * manipulan el cubo con la otra.
 *
 * PRECAUCIÓN: Solo se activa cuando la tarjeta está volteada (isFlipped), evitando
 * al 100% que dos tarjetas pasen consecutivas por accidente.
 */
export function useDeviceTilt(options: DeviceTiltOptions = {}) {
  const isSupported = ref(typeof window !== 'undefined' && 'DeviceOrientationEvent' in window)
  const hasPermission = ref(true)
  const isListening = ref(false)
  const isLocked = ref(false)

  // Grados absolutos crudos
  const rawBeta = ref(0)
  const rawGamma = ref(0)

  // Grados suavizados con respuesta rápida para gestos látigo
  const smoothBeta = ref(45)
  const smoothGamma = ref(0)

  // Velocidad angular (grados por segundo) para detectar el latigazo
  const velocityX = ref(0)
  const velocityY = ref(0)

  // Línea de base (posición neutral de descanso de la mano)
  const baselineBeta = ref<number | null>(null)
  const baselineGamma = ref<number | null>(null)

  // Diferencia respecto a la posición neutra
  const deltaX = ref(0)
  const deltaY = ref(0)

  // Temporizadores
  let holdTimer: number | null = null
  let cooldownTimer: number | null = null
  let isCalibrated = false
  let lastTimestamp = 0
  let lastRawGamma = 0
  let lastRawBeta = 45

  const isEnabled = computed(() => {
    if (!options.enabled) return true
    return typeof options.enabled === 'function' ? options.enabled() : options.enabled.value
  })

  const sensitivity = computed<TiltSensitivity>(() => {
    if (!options.sensitivity) return 'normal'
    return typeof options.sensitivity === 'function' ? options.sensitivity() : options.sensitivity.value
  })

  // Umbrales angulares y de velocidad de latigazo según sensibilidad
  const thresholds = computed(() => {
    switch (sensitivity.value) {
      case 'high':
        return {
          steadyX: 14,
          steadyY: 16,
          whipAngle: 10,
          whipSpeed: 95, // deg/sec
        }
      case 'low':
        return {
          steadyX: 24,
          steadyY: 26,
          whipAngle: 17,
          whipSpeed: 160,
        }
      case 'normal':
      default:
        return {
          steadyX: 18,
          steadyY: 20,
          whipAngle: 13,
          whipSpeed: 120,
        }
    }
  })

  // Progreso hacia el umbral de disparo [0, 1.25]
  const progress = computed(() => {
    const { steadyX, steadyY } = thresholds.value
    const normX = Math.abs(deltaX.value) / steadyX
    const normY = Math.abs(deltaY.value) / steadyY
    return Math.min(Math.hypot(normX, normY), 1.3)
  })

  // Velocidad total del movimiento de muñeca
  const totalSpeed = computed(() => Math.hypot(velocityX.value, velocityY.value))

  // Dirección dominante activa
  const activeDirection = computed<TiltDirection | null>(() => {
    if (progress.value < 0.22 && totalSpeed.value < 60) return null

    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)

    if (absX >= absY) {
      return deltaX.value > 0 ? 'right' : 'left'
    } else {
      // deltaY < 0 es latigazo hacia adelante (arriba); deltaY > 0 hacia el usuario (abajo)
      return deltaY.value < 0 ? 'up' : 'down'
    }
  })

  // ¿Ha superado el umbral sostenido o de latigazo?
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
    velocityX.value = 0
    velocityY.value = 0
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
  function lockUntilNeutral(cooldownMs: number = 350) {
    isLocked.value = true
    clearTimers()

    cooldownTimer = window.setTimeout(() => {
      // El desbloqueo real ocurrirá en handleOrientation cuando vuelva al centro neutro
    }, cooldownMs)
  }

  /**
   * Ejecuta el disparo de calificación con confirmación háptica estilo látigo
   */
  function executeTrigger(direction: TiltDirection) {
    if (isLocked.value || !isEnabled.value) return

    // Vibración de doble pulso rápida estilo "chasquido de látigo"
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([20, 25, 30])
      } catch (_) {}
    }

    clearTimers()
    options.onTrigger?.(direction)
    lockUntilNeutral(450)
  }

  function handleOrientation(event: DeviceOrientationEvent) {
    if (!isEnabled.value) return

    const beta = event.beta ?? 45 // Pitch: frente / atrás
    const gamma = event.gamma ?? 0 // Roll: izquierda / derecha

    rawBeta.value = beta
    rawGamma.value = gamma

    const now = performance.now()
    if (lastTimestamp > 0) {
      const dt = (now - lastTimestamp) / 1000
      if (dt > 0.005 && dt < 0.25) {
        const rawVelX = (gamma - lastRawGamma) / dt
        const rawVelY = (beta - lastRawBeta) / dt
        // Suavizado rápido para capturar el latigazo instantáneamente
        velocityX.value += (rawVelX - velocityX.value) * 0.6
        velocityY.value += (rawVelY - velocityY.value) * 0.6
      }
    }
    lastTimestamp = now
    lastRawGamma = gamma
    lastRawBeta = beta

    // Filtro con factor 0.5 para respuesta ultra ágil al latigazo
    smoothBeta.value += (beta - smoothBeta.value) * 0.5
    smoothGamma.value += (gamma - smoothGamma.value) * 0.5

    // Primera calibración automática en reposo
    if (!isCalibrated || baselineBeta.value === null || baselineGamma.value === null) {
      baselineBeta.value = smoothBeta.value
      baselineGamma.value = smoothGamma.value
      isCalibrated = true
    }

    // Desviación relativa respecto al centro neutro
    deltaX.value = smoothGamma.value - (baselineGamma.value || 0)
    deltaY.value = smoothBeta.value - (baselineBeta.value || 45)

    // Si estaba bloqueado, desbloquear solo al regresar cerca del centro neutro
    if (isLocked.value) {
      if (progress.value < 0.28) {
        isLocked.value = false
      }
      return
    }

    const dir = activeDirection.value
    if (!dir) {
      if (holdTimer !== null) {
        clearTimeout(holdTimer)
        holdTimer = null
      }
      return
    }

    const { whipAngle, whipSpeed } = thresholds.value
    const absX = Math.abs(deltaX.value)
    const absY = Math.abs(deltaY.value)
    const dominantAngle = Math.max(absX, absY)
    const dominantSpeed = Math.max(Math.abs(velocityX.value), Math.abs(velocityY.value))

    // ⚡ DETECCIÓN DE LATIGAZO (Whip flick instantáneo):
    // Si la velocidad angular es alta y el ángulo de muñeca superó el umbral de látigo
    if (dominantSpeed >= whipSpeed && dominantAngle >= whipAngle) {
      executeTrigger(dir)
      return
    }

    // Detección por inclinación progresiva / sostenida (como respaldo suave)
    if (isPastThreshold.value) {
      if (holdTimer === null) {
        const holdMs = options.holdDurationMs ?? 75 // Muy rápido (75ms)
        const triggerDir = dir

        holdTimer = window.setTimeout(() => {
          if (isPastThreshold.value && activeDirection.value === triggerDir && !isLocked.value) {
            executeTrigger(triggerDir)
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
    lastTimestamp = 0
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
    velocityX,
    velocityY,
    totalSpeed,
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
