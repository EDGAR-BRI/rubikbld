<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import type { PairItem } from '@/models/pair'
import type { SRSCard, ReviewRating } from '@/models/card'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import { useDeviceTilt, type TiltDirection } from '@/composables/useDeviceTilt'

const props = withDefaults(
  defineProps<{
    pair: PairItem
    card: SRSCard
    isFlipped: boolean
    reverseMode?: boolean
    enableGestures?: boolean
    allowSwipeBeforeFlip?: boolean
    sensitivity?: 'normal' | 'high' | 'low'
    enableTilt?: boolean
    tiltSensitivity?: 'normal' | 'high' | 'low'
    intervals?: {
      1: string
      2: string
      3: string
      4: string
    }
  }>(),
  {
    reverseMode: false,
    enableGestures: true,
    allowSwipeBeforeFlip: true,
    sensitivity: 'normal',
    enableTilt: false,
    tiltSensitivity: 'normal',
    intervals: () => ({
      1: '1m',
      2: '1m',
      3: '10m',
      4: '4d',
    }),
  },
)

const emit = defineEmits<{
  (e: 'flip'): void
  (e: 'edit', pair: PairItem): void
  (e: 'rate', rating: ReviewRating): void
}>()

// Contenedor principal de la tarjeta
const cardContainerRef = ref<HTMLElement | null>(null)

// Candado de seguridad para el reverso: NO renderizar la foto/palabra en el DOM
// hasta que el usuario efectivamente voltee la tarjeta por primera vez.
// Esto evita 100% que en móviles lentos se filtre la imagen durante transiciones.
const hasFlippedOnce = ref(props.isFlipped)
watch(
  () => props.isFlipped,
  (val) => {
    if (val) {
      hasFlippedOnce.value = true
      // PRECAUCIÓN: Al voltear la tarjeta se calibra el neutro y se activa un breve bloqueo
      // de 280ms para evitar que el toque de volteo dispare el latigazo por error.
      tilt.calibrate()
      tilt.lockUntilNeutral(280)
    }
  },
  { immediate: true },
)

// Estados de arrastre / swipe
const isDragging = ref(false)
const dragX = ref(0)
const dragY = ref(0)
const isExiting = ref(false)
const exitDirection = ref<'right' | 'left' | 'up' | 'down' | null>(null)
const hasPassedThreshold = ref(false)

let pointerId: number | null = null
let startX = 0
let startY = 0
let lastPointerX = 0
let lastPointerY = 0
let hasMoved = false
let rafId: number | null = null

// Umbral en píxeles según sensibilidad de deslizamiento
const threshold = computed(() => {
  if (props.sensitivity === 'high') return 55
  if (props.sensitivity === 'low') return 95
  return 75
})

// Distancia total recorrida por arrastre táctil
const dragDistance = computed(() => Math.hypot(dragX.value, dragY.value))

// Integración del sensor de giroscopio con gesto estilo "Látigo" (Whip flick)
// PRECAUCIÓN ESTRICTA: Solo activo cuando la tarjeta está dada vuelta (props.isFlipped)
const tilt = useDeviceTilt({
  enabled: () => !!props.enableTilt && props.isFlipped && !isDragging.value,
  sensitivity: () => props.tiltSensitivity ?? 'normal',
  holdDurationMs: 75,
  onTrigger: (direction) => {
    handleTiltTrigger(direction)
  },
})

// Recalibrar posición neutra al cambiar de tarjeta
watch(
  () => props.card.id,
  () => {
    hasFlippedOnce.value = props.isFlipped
    tilt.calibrate()
    tilt.lockUntilNeutral(400)
  },
)

function triggerCardExit(rating: ReviewRating, direction: 'right' | 'left' | 'up' | 'down') {
  if (isExiting.value) return
  exitDirection.value = direction
  isExiting.value = true

  if (navigator?.vibrate) {
    try {
      navigator.vibrate(30)
    } catch {}
  }

  // CRUCIAL: Esperar a que la tarjeta actual vuele fuera de pantalla (180ms)
  // ANTES de avisar al store. De esta forma, la siguiente tarjeta NUNCA se muestra
  // mientras la anterior sale, evitando que se vea la foto por unos milisegundos.
  setTimeout(() => {
    emit('rate', rating)
    isExiting.value = false
    exitDirection.value = null
    dragX.value = 0
    dragY.value = 0
    isDragging.value = false
    hasPassedThreshold.value = false
  }, 190)
}

function handleTiltTrigger(direction: TiltDirection) {
  if (isDragging.value || isExiting.value) return
  // PRECAUCIÓN ESTRICTA: El giroscopio SOLO califica cuando la tarjeta está dada vuelta
  if (!props.isFlipped) return

  const ratingMap: Record<TiltDirection, ReviewRating> = {
    right: 3,
    left: 1,
    up: 4,
    down: 2,
  }
  const rating = ratingMap[direction]
  triggerCardExit(rating, direction)
}

// Dirección dominante actual (Soporta arrastre táctil o latigazo del móvil)
const activeDirection = computed<'right' | 'left' | 'up' | 'down' | null>(() => {
  if (isDragging.value) {
    if (dragDistance.value < 10) return null
    const absX = Math.abs(dragX.value)
    const absY = Math.abs(dragY.value)

    if (absX >= absY) {
      return dragX.value > 0 ? 'right' : 'left'
    } else {
      return dragY.value < 0 ? 'up' : 'down'
    }
  }

  // Si no se arrastra con el dedo, verificar latigazo activo (SOLO si la tarjeta está volteada)
  if (props.enableTilt && props.isFlipped && !tilt.isLocked.value && (tilt.progress.value >= 0.22 || tilt.totalSpeed.value >= 50)) {
    return tilt.activeDirection.value
  }

  return null
})

// Objeto con la información de la acción activa (estilo Gmail)
const activeAction = computed(() => {
  if (!activeDirection.value) return null

  switch (activeDirection.value) {
    case 'right':
      return {
        direction: 'right' as const,
        rating: 3 as ReviewRating,
        title: 'BIEN',
        interval: props.intervals[3] || '10m',
        icon: 'lucide:check-circle-2',
        color: 'emerald',
        bgPill: 'bg-emerald-950/95 border-emerald-500/80 text-emerald-300',
        glowRing: 'ring-2 ring-emerald-500',
        badgeColor: 'text-emerald-400',
      }
    case 'left':
      return {
        direction: 'left' as const,
        rating: 1 as ReviewRating,
        title: 'OTRA VEZ',
        interval: props.intervals[1] || '1m',
        icon: 'lucide:rotate-ccw',
        color: 'rose',
        bgPill: 'bg-rose-950/95 border-rose-500/80 text-rose-300',
        glowRing: 'ring-2 ring-rose-500',
        badgeColor: 'text-rose-400',
      }
    case 'up':
      return {
        direction: 'up' as const,
        rating: 4 as ReviewRating,
        title: 'FÁCIL',
        interval: props.intervals[4] || '4d',
        icon: 'lucide:zap',
        color: 'sky',
        bgPill: 'bg-sky-950/95 border-sky-500/80 text-sky-300',
        glowRing: 'ring-2 ring-sky-500',
        badgeColor: 'text-sky-400',
      }
    case 'down':
      return {
        direction: 'down' as const,
        rating: 2 as ReviewRating,
        title: 'DIFÍCIL',
        interval: props.intervals[2] || '1m',
        icon: 'lucide:flame',
        color: 'amber',
        bgPill: 'bg-amber-950/95 border-amber-500/80 text-amber-300',
        glowRing: 'ring-2 ring-amber-500',
        badgeColor: 'text-amber-400',
      }
  }
})

// ¿Hay una acción de arrastre o latigazo activa?
const isActionInProgress = computed(() => {
  if (isDragging.value) return true
  if (props.enableTilt && props.isFlipped && !tilt.isLocked.value && (tilt.progress.value >= 0.25 || tilt.totalSpeed.value >= 70)) {
    return true
  }
  return false
})

// ¿Ha superado el umbral para confirmar?
const isActionConfirmed = computed(() => {
  if (isDragging.value) return hasPassedThreshold.value
  if (props.enableTilt && props.isFlipped) return tilt.isPastThreshold.value
  return false
})

// Porcentaje de avance hacia el umbral
const gestureProgress = computed(() => {
  if (isDragging.value) {
    return Math.min(dragDistance.value / threshold.value, 1.25)
  }
  if (props.enableTilt && props.isFlipped) {
    return tilt.progress.value
  }
  return 0
})

// Texto de ayuda dinámico según el modo (arrastre o latigazo)
const helperText = computed(() => {
  if (isDragging.value) {
    return hasPassedThreshold.value ? '¡Suelta para calificar!' : 'Desliza más para confirmar...'
  }
  if (props.enableTilt && props.isFlipped) {
    return tilt.isPastThreshold.value ? '¡Gesto confirmado!' : 'Gira rápido con la muñeca (látigo)...'
  }
  return ''
})

// Offset visual dinámico cuando se hace el latigazo con el móvil (SOLO si está volteada)
const tiltVisualX = computed(() => {
  if (!props.enableTilt || !props.isFlipped || isDragging.value || isExiting.value) return 0
  return Math.max(Math.min(tilt.deltaX.value * 4.2, 95), -95)
})

const tiltVisualY = computed(() => {
  if (!props.enableTilt || !props.isFlipped || isDragging.value || isExiting.value) return 0
  return Math.max(Math.min(tilt.deltaY.value * 3.5, 80), -80)
})

// Estilo de transformación reactivo y ligero (aceleración GPU con translate3d)
const cardTransformStyle = computed(() => {
  if (isExiting.value && exitDirection.value) {
    let exitX = 0
    let exitY = 0
    let exitRotate = 0

    if (exitDirection.value === 'right') {
      exitX = 580
      exitRotate = 20
    } else if (exitDirection.value === 'left') {
      exitX = -580
      exitRotate = -20
    } else if (exitDirection.value === 'up') {
      exitY = -580
      exitRotate = 0
    } else if (exitDirection.value === 'down') {
      exitY = 580
      exitRotate = 0
    }

    // Salida veloz estilo chasquido de látigo
    return {
      transform: `translate3d(${exitX}px, ${exitY}px, 0) rotate(${exitRotate}deg) scale(0.88)`,
      opacity: '0',
      transition: 'transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1.2), opacity 0.14s ease-out',
      willChange: 'transform, opacity',
    }
  }

  if (isDragging.value) {
    const rotation = dragX.value * 0.04
    return {
      transform: `translate3d(${dragX.value}px, ${dragY.value}px, 0) rotate(${rotation}deg)`,
      transition: 'none',
      willChange: 'transform',
    }
  }

  if (props.enableTilt && props.isFlipped && (tiltVisualX.value !== 0 || tiltVisualY.value !== 0)) {
    const rotation = tiltVisualX.value * 0.1
    return {
      transform: `translate3d(${tiltVisualX.value}px, ${tiltVisualY.value}px, 0) rotate(${rotation}deg)`,
      transition: 'transform 0.06s ease-out',
      willChange: 'transform',
    }
  }

  return {
    transform: 'translate3d(0, 0, 0) rotate(0deg)',
    transition: 'transform 0.28s cubic-bezier(0.18, 0.89, 0.32, 1.15)',
    willChange: 'auto',
  }
})

// Manejo de eventos Pointer con rAF para alto rendimiento en móviles gama de entrada
function onPointerDown(e: PointerEvent) {
  if (!props.enableGestures) return
  const target = e.target as HTMLElement | null
  if (target?.closest('button, a, input, select, textarea')) return

  pointerId = e.pointerId
  startX = e.clientX
  startY = e.clientY
  lastPointerX = e.clientX
  lastPointerY = e.clientY
  hasMoved = false
  isDragging.value = false
  hasPassedThreshold.value = false

  try {
    cardContainerRef.value?.setPointerCapture(e.pointerId)
  } catch {}
}

function onPointerMove(e: PointerEvent) {
  if (pointerId === null || pointerId !== e.pointerId) return
  lastPointerX = e.clientX
  lastPointerY = e.clientY

  // Throttle con requestAnimationFrame para mantener 60fps sin saturar la CPU
  if (!rafId) {
    rafId = requestAnimationFrame(processDragMove)
  }
}

function processDragMove() {
  rafId = null
  if (pointerId === null) return

  const dx = lastPointerX - startX
  const dy = lastPointerY - startY
  const dist = Math.hypot(dx, dy)

  if (dist > 8) {
    hasMoved = true

    if (!props.isFlipped && !props.allowSwipeBeforeFlip) {
      return
    }

    isDragging.value = true

    const factor = dist > threshold.value ? 0.75 : 1
    dragX.value = dx * factor
    dragY.value = dy * factor

    const passed = dist >= threshold.value
    if (passed && !hasPassedThreshold.value) {
      hasPassedThreshold.value = true
      if (navigator?.vibrate) {
        navigator.vibrate(20)
      }
    } else if (!passed && hasPassedThreshold.value) {
      hasPassedThreshold.value = false
    }
  }
}

function onPointerUp(e: PointerEvent) {
  if (pointerId === null || pointerId !== e.pointerId) return

  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  try {
    cardContainerRef.value?.releasePointerCapture(e.pointerId)
  } catch {}

  pointerId = null

  if (!hasMoved) {
    // Fue un simple toque (tap)
    if (!props.isFlipped) {
      emit('flip')
    }
    return
  }

  if (isDragging.value) {
    const dist = dragDistance.value
    const passed = dist >= threshold.value

    if (passed && activeAction.value) {
      triggerCardExit(activeAction.value.rating, activeAction.value.direction)
    } else {
      // No superó el umbral: retorno suave
      dragX.value = 0
      dragY.value = 0
      hasPassedThreshold.value = false
      setTimeout(() => {
        isDragging.value = false
      }, 280)
    }
  }
}

function onPointerCancel(e: PointerEvent) {
  if (pointerId !== e.pointerId) return
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  pointerId = null
  dragX.value = 0
  dragY.value = 0
  isDragging.value = false
  hasPassedThreshold.value = false
}

function onKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space' && !props.isFlipped) {
    e.preventDefault()
    emit('flip')
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
})
</script>

<template>
  <div class="relative w-full max-w-sm mx-auto h-[380px] sm:h-[420px] select-none touch-none contain-layout">
    <!-- Pistas directas de fondo (Backdrop cues en los 4 bordes) -->
    <div
      class="absolute inset-0 pointer-events-none transition-opacity duration-150 z-0 flex flex-col justify-between p-1"
      :class="isActionInProgress ? 'opacity-90' : 'opacity-0'"
    >
      <!-- Cue Arriba: Fácil -->
      <div class="flex justify-center">
        <div
          :class="[
            'px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md',
            activeDirection === 'up'
              ? 'bg-sky-500 text-white scale-105 ring-2 ring-sky-400'
              : 'bg-dark-900 text-sky-400 border border-sky-500/30',
          ]"
        >
          <AppIcon name="lucide:arrow-up" :size="13" />
          <span>FÁCIL ({{ intervals[4] }})</span>
          <AppIcon name="lucide:zap" :size="12" />
        </div>
      </div>

      <!-- Cues Laterales: Izquierda (Otra vez) y Derecha (Bien) -->
      <div class="flex items-center justify-between px-1">
        <!-- Cue Izquierda: Otra vez -->
        <div
          :class="[
            'px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md',
            activeDirection === 'left'
              ? 'bg-rose-600 text-white scale-105 ring-2 ring-rose-400'
              : 'bg-dark-900 text-rose-400 border border-rose-500/30',
          ]"
        >
          <AppIcon name="lucide:arrow-left" :size="13" />
          <span>OTRA VEZ ({{ intervals[1] }})</span>
        </div>

        <!-- Cue Derecha: Bien -->
        <div
          :class="[
            'px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md',
            activeDirection === 'right'
              ? 'bg-emerald-600 text-white scale-105 ring-2 ring-emerald-400'
              : 'bg-dark-900 text-emerald-400 border border-emerald-500/30',
          ]"
        >
          <span>BIEN ({{ intervals[3] }})</span>
          <AppIcon name="lucide:arrow-right" :size="13" />
        </div>
      </div>

      <!-- Cue Abajo: Difícil -->
      <div class="flex justify-center">
        <div
          :class="[
            'px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md',
            activeDirection === 'down'
              ? 'bg-amber-600 text-white scale-105 ring-2 ring-amber-400'
              : 'bg-dark-900 text-amber-400 border border-amber-500/30',
          ]"
        >
          <AppIcon name="lucide:arrow-down" :size="13" />
          <span>DIFÍCIL ({{ intervals[2] }})</span>
          <AppIcon name="lucide:flame" :size="12" />
        </div>
      </div>
    </div>

    <!-- Contenedor Arrastrable de la Tarjeta -->
    <div
      ref="cardContainerRef"
      class="relative w-full h-full cursor-grab active:cursor-grabbing z-10 perspective-1000"
      :style="cardTransformStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <!-- OVERLAY DE AYUDA GMAIL & TILT (Optimizado para GPU sin backdrop-filter costoso) -->
      <div
        v-if="isActionInProgress && activeAction"
        class="absolute inset-0 z-30 pointer-events-none rounded-3xl flex flex-col items-center justify-center p-4 transition-opacity duration-100"
        :style="{
          opacity: Math.min(gestureProgress * 1.15, 1),
          backgroundColor: isActionConfirmed
            ? activeAction.color === 'emerald'
              ? 'rgba(6, 78, 59, 0.70)'
              : activeAction.color === 'rose'
                ? 'rgba(136, 19, 55, 0.70)'
                : activeAction.color === 'sky'
                  ? 'rgba(12, 74, 110, 0.70)'
                  : 'rgba(120, 53, 15, 0.70)'
            : 'rgba(15, 23, 42, 0.55)',
        }"
      >
        <!-- Pill Central Dinámico -->
        <div
          :class="[
            'px-5 py-3 rounded-2xl border-2 flex flex-col items-center gap-1 shadow-xl transition-transform duration-100',
            activeAction.bgPill,
            isActionConfirmed ? 'scale-105 ring-2 ring-white/30' : 'scale-95',
          ]"
        >
          <div class="flex items-center gap-2">
            <AppIcon
              :name="!isDragging && enableTilt ? 'lucide:smartphone' : activeAction.icon"
              :size="22"
              :class="activeAction.badgeColor"
            />
            <span class="text-xl font-black tracking-wider uppercase font-mono">
              {{ activeAction.title }}
            </span>
            <span class="text-sm font-bold font-mono px-2 py-0.5 rounded-lg bg-black/60 border border-white/10">
              {{ activeAction.interval }}
            </span>
          </div>

          <!-- Texto de ayuda según modo de control -->
          <p class="text-[11px] font-semibold tracking-wide">
            {{ helperText }}
          </p>
        </div>
      </div>

      <!-- Tarjeta 3D Volteable -->
      <div
        :class="[
          'relative w-full h-full transition-transform duration-300 ease-out transform-style-3d rounded-3xl shadow-xl',
          isFlipped ? 'rotate-y-180' : '',
          isActionInProgress && activeAction ? activeAction.glowRing : '',
        ]"
      >
        <!-- FRONT OF THE CARD -->
        <div
          class="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-dark-900 to-dark-950 border border-dark-700/80 rounded-3xl p-6 flex flex-col justify-between items-center text-center shadow-lg overflow-hidden"
          style="-webkit-backface-visibility: hidden; backface-visibility: hidden;"
        >
          <!-- Top bar of card -->
          <div class="w-full flex items-center justify-between">
            <AppBadge
              :variant="card.usage === 'both' ? 'accent' : card.usage === 'corner' ? 'warning' : 'success'"
            >
              {{ card.usage === 'both' ? 'Ambas' : card.usage === 'corner' ? 'Solo Esquinas' : 'Solo Aristas' }}
            </AppBadge>

            <span
              v-if="card.state === 'new'"
              class="text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20"
            >
              NUEVA
            </span>
            <span
              v-else-if="card.state === 'learning' || card.state === 'relearning'"
              class="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20"
            >
              APRENDIENDO
            </span>
            <span
              v-else
              class="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"
            >
              REPASO
            </span>
          </div>

          <!-- Center Content (Front) -->
          <div class="my-auto flex flex-col items-center justify-center">
            <template v-if="!reverseMode">
              <div class="text-7xl sm:text-8xl font-black tracking-widest text-white font-mono drop-shadow-sm">
                {{ pair.pair }}
              </div>
              <p class="text-xs text-slate-500 mt-4 tracking-wider uppercase">
                Toca para ver respuesta o desliza
              </p>
            </template>

            <template v-else>
              <!-- Modo Inverso: Ver imagen/palabra primero -->
              <div v-if="pair.image" class="w-40 h-40 rounded-2xl overflow-hidden mb-3 border border-dark-700">
                <img :src="pair.image" class="w-full h-full object-cover" loading="eager" />
              </div>
              <div class="text-3xl font-extrabold text-green-300">
                {{ pair.word || 'Sin palabra asignada' }}
              </div>
              <p class="text-xs text-slate-500 mt-4 tracking-wider uppercase">
                ¿Cuál es el par de letras?
              </p>
            </template>
          </div>

          <!-- Bottom hint -->
          <div class="w-full flex items-center justify-center text-slate-400 text-xs py-1">
            <div class="flex items-center gap-1.5">
              <AppIcon name="lucide:hand" :size="15" class="text-slate-400" />
              <span>Toca para voltear <span class="hidden sm:inline text-slate-500 font-mono text-[11px]">(Espacio)</span></span>
            </div>
          </div>
        </div>

        <!-- BACK OF THE CARD (Solo se monta cuando la tarjeta se voltea) -->
        <div
          v-if="hasFlippedOnce"
          class="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-dark-850 to-dark-900 border border-green-500/30 rounded-3xl p-5 flex flex-col justify-between items-center text-center shadow-lg overflow-hidden"
          style="-webkit-backface-visibility: hidden; backface-visibility: hidden;"
        >
          <!-- Top bar of back card -->
          <div class="w-full flex items-center justify-between">
            <span class="text-xs font-mono font-bold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg">
              {{ pair.pair }}
            </span>

            <button
              type="button"
              class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors pointer-events-auto"
              title="Editar palabra o imagen"
              @pointerdown.stop
              @click.stop="emit('edit', pair)"
            >
              <AppIcon name="lucide:pencil" :size="16" />
            </button>
          </div>

          <!-- Center Content (Back) -->
          <div class="my-auto flex flex-col items-center justify-center w-full px-2">
            <!-- Imagen si existe -->
            <div
              v-if="pair.image"
              class="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border border-dark-700 bg-dark-950 mb-3 flex items-center justify-center"
            >
              <img
                :src="pair.image"
                alt="Mnemotecnia"
                class="w-full h-full object-contain"
                loading="eager"
              />
            </div>

            <!-- Palabra Mnemotécnica -->
            <div class="text-2xl sm:text-3xl font-black text-white tracking-wide">
              {{ pair.word || '(Sin palabra definida aún)' }}
            </div>

            <!-- Notas / historia mnemotécnica -->
            <p
              v-if="pair.notes"
              class="text-xs text-slate-300 mt-2 px-4 py-1.5 bg-dark-950/60 rounded-xl border border-dark-800 line-clamp-2"
            >
              {{ pair.notes }}
            </p>
          </div>

          <!-- Bottom Interval / Details info -->
          <div class="w-full flex items-center justify-between text-[11px] text-slate-400 px-2 pt-2 border-t border-dark-800">
            <span>Repasos: {{ card.repetitions }}</span>
            <span v-if="enableTilt" class="text-emerald-400 font-semibold flex items-center gap-1">
              <AppIcon name="lucide:zap" :size="12" />
              <span>Gesto látigo activo</span>
            </span>
            <span v-else>Facilidad: {{ (card.easeFactor * 100).toFixed(0) }}%</span>
            <span>Fallos: {{ card.lapses }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
