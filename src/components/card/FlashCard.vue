<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { PairItem } from '@/models/pair'
import type { SRSCard, ReviewRating } from '@/models/card'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    pair: PairItem
    card: SRSCard
    isFlipped: boolean
    reverseMode?: boolean
    enableGestures?: boolean
    allowSwipeBeforeFlip?: boolean
    sensitivity?: 'normal' | 'high' | 'low'
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

// Contenedor principal de la tarjeta para interacción táctil/ratón
const cardContainerRef = ref<HTMLElement | null>(null)

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
let hasMoved = false

// Umbral en píxeles según sensibilidad
const threshold = computed(() => {
  if (props.sensitivity === 'high') return 55
  if (props.sensitivity === 'low') return 95
  return 75
})

// Distancia total recorrida
const dragDistance = computed(() => Math.hypot(dragX.value, dragY.value))

// Dirección dominante actual
const activeDirection = computed<'right' | 'left' | 'up' | 'down' | null>(() => {
  if (dragDistance.value < 10) return null
  const absX = Math.abs(dragX.value)
  const absY = Math.abs(dragY.value)

  if (absX >= absY) {
    return dragX.value > 0 ? 'right' : 'left'
  } else {
    return dragY.value < 0 ? 'up' : 'down'
  }
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
        bgPill: 'bg-emerald-500/25 border-emerald-500/70 text-emerald-300',
        glowRing: 'ring-2 ring-emerald-500 shadow-emerald-500/30',
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
        bgPill: 'bg-rose-500/25 border-rose-500/70 text-rose-300',
        glowRing: 'ring-2 ring-rose-500 shadow-rose-500/30',
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
        bgPill: 'bg-sky-500/25 border-sky-500/70 text-sky-300',
        glowRing: 'ring-2 ring-sky-500 shadow-sky-500/30',
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
        bgPill: 'bg-amber-500/25 border-amber-500/70 text-amber-300',
        glowRing: 'ring-2 ring-amber-500 shadow-amber-500/30',
        badgeColor: 'text-amber-400',
      }
  }
})

// Porcentaje de avance hacia el umbral
const gestureProgress = computed(() => {
  return Math.min(dragDistance.value / threshold.value, 1.3)
})

// Estilo de transformación reactivo de la tarjeta
const cardTransformStyle = computed(() => {
  if (isExiting.value && exitDirection.value) {
    let exitX = 0
    let exitY = 0
    let exitRotate = 0

    if (exitDirection.value === 'right') {
      exitX = 600
      exitRotate = 20
    } else if (exitDirection.value === 'left') {
      exitX = -600
      exitRotate = -20
    } else if (exitDirection.value === 'up') {
      exitY = -600
      exitRotate = 0
    } else if (exitDirection.value === 'down') {
      exitY = 600
      exitRotate = 0
    }

    return {
      transform: `translate3d(${exitX}px, ${exitY}px, 0) rotate(${exitRotate}deg) scale(0.85)`,
      opacity: '0',
      transition: 'transform 0.22s ease-out, opacity 0.22s ease-out',
    }
  }

  if (isDragging.value) {
    // Rotación sutil y tangible al arrastrar horizontalmente
    const rotation = (dragX.value / 18)
    return {
      transform: `translate3d(${dragX.value}px, ${dragY.value}px, 0) rotate(${rotation}deg)`,
      transition: 'none',
    }
  }

  return {
    transform: 'translate3d(0, 0, 0) rotate(0deg)',
    transition: 'transform 0.32s cubic-bezier(0.18, 0.89, 0.32, 1.15)',
  }
})

// Manejo de eventos Pointer (Tactil + Ratón)
function onPointerDown(e: PointerEvent) {
  if (!props.enableGestures) return
  // Si se hace clic en botones interactivos (como el lápiz de edición), no arrastrar
  const target = e.target as HTMLElement | null
  if (target?.closest('button, a, input, select, textarea')) return

  pointerId = e.pointerId
  startX = e.clientX
  startY = e.clientY
  hasMoved = false
  isDragging.value = false
  hasPassedThreshold.value = false

  try {
    cardContainerRef.value?.setPointerCapture(e.pointerId)
  } catch {
    // Si el navegador no soporta setPointerCapture en este contexto, continuar
  }
}

function onPointerMove(e: PointerEvent) {
  if (pointerId === null || pointerId !== e.pointerId) return

  const dx = e.clientX - startX
  const dy = e.clientY - startY
  const dist = Math.hypot(dx, dy)

  if (dist > 8) {
    hasMoved = true

    // Si la tarjeta no está volteada y está deshabilitado el swipe antes de voltear, no arrastrar
    if (!props.isFlipped && !props.allowSwipeBeforeFlip) {
      return
    }

    isDragging.value = true

    // Resistencia elástica más allá del umbral para sensación orgánica
    const factor = dist > threshold.value ? 0.8 : 1
    dragX.value = dx * factor
    dragY.value = dy * factor

    // Detección de cruce de umbral y vibración háptica
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

  try {
    cardContainerRef.value?.releasePointerCapture(e.pointerId)
  } catch {
    // Ignorar si ya fue liberado
  }

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
      // Swipe exitoso: animación de salida y registrar calificación
      const rating = activeAction.value.rating
      exitDirection.value = activeAction.value.direction
      isExiting.value = true

      if (navigator?.vibrate) {
        navigator.vibrate(25)
      }

      emit('rate', rating)

      // Restablecer posición después de la animación de salida
      setTimeout(() => {
        isExiting.value = false
        exitDirection.value = null
        dragX.value = 0
        dragY.value = 0
        isDragging.value = false
        hasPassedThreshold.value = false
      }, 230)
    } else {
      // No superó el umbral: retorno suave
      dragX.value = 0
      dragY.value = 0
      hasPassedThreshold.value = false
      setTimeout(() => {
        isDragging.value = false
      }, 320)
    }
  }
}

function onPointerCancel(e: PointerEvent) {
  if (pointerId !== e.pointerId) return
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
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="relative w-full max-w-sm mx-auto h-[380px] sm:h-[420px] select-none touch-none">
    <!-- Pistas directas de fondo (Backdrop Gmail cues en los 4 bordes) -->
    <div
      class="absolute inset-0 pointer-events-none transition-opacity duration-200 z-0 flex flex-col justify-between p-1"
      :class="isDragging ? 'opacity-90' : 'opacity-0'"
    >
      <!-- Cue Arriba: Fácil -->
      <div class="flex justify-center">
        <div
          :class="[
            'px-3 py-1 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-md',
            activeDirection === 'up'
              ? 'bg-sky-500 text-white scale-110 shadow-sky-500/40 ring-2 ring-sky-400'
              : 'bg-dark-900/90 text-sky-400 border border-sky-500/30',
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
              ? 'bg-rose-600 text-white scale-110 shadow-rose-600/40 ring-2 ring-rose-400'
              : 'bg-dark-900/90 text-rose-400 border border-rose-500/30',
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
              ? 'bg-emerald-600 text-white scale-110 shadow-emerald-600/40 ring-2 ring-emerald-400'
              : 'bg-dark-900/90 text-emerald-400 border border-emerald-500/30',
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
              ? 'bg-amber-600 text-white scale-110 shadow-amber-600/40 ring-2 ring-amber-400'
              : 'bg-dark-900/90 text-amber-400 border border-amber-500/30',
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
      class="relative w-full h-full cursor-grab active:cursor-grabbing z-10 will-change-transform perspective-1000"
      :style="cardTransformStyle"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
    >
      <!-- OVERLAY DE AYUDA GMAIL (Aparece en tiempo real sobre la tarjeta al arrastrar) -->
      <div
        v-if="isDragging && activeAction"
        class="absolute inset-0 z-30 pointer-events-none rounded-3xl flex flex-col items-center justify-center p-4 transition-all duration-150 backdrop-blur-[2px]"
        :style="{
          opacity: Math.min(gestureProgress * 1.1, 1),
          backgroundColor: hasPassedThreshold
            ? activeAction.color === 'emerald'
              ? 'rgba(6, 78, 59, 0.45)'
              : activeAction.color === 'rose'
                ? 'rgba(136, 19, 55, 0.45)'
                : activeAction.color === 'sky'
                  ? 'rgba(12, 74, 110, 0.45)'
                  : 'rgba(120, 53, 15, 0.45)'
            : 'rgba(15, 23, 42, 0.35)',
        }"
      >
        <!-- Pill Central Dinámico -->
        <div
          :class="[
            'px-5 py-3.5 rounded-2xl border-2 flex flex-col items-center gap-1.5 shadow-2xl backdrop-blur-md transition-transform duration-150',
            activeAction.bgPill,
            hasPassedThreshold ? 'scale-110 shadow-2xl ring-4 ring-white/20' : 'scale-95',
          ]"
        >
          <div class="flex items-center gap-2">
            <AppIcon :name="activeAction.icon" :size="24" :class="activeAction.badgeColor" />
            <span class="text-xl font-black tracking-wider uppercase font-mono">
              {{ activeAction.title }}
            </span>
            <span class="text-sm font-bold font-mono px-2 py-0.5 rounded-lg bg-black/40 border border-white/10">
              {{ activeAction.interval }}
            </span>
          </div>

          <!-- Texto de ayuda estilo Gmail -->
          <p class="text-[11px] font-semibold tracking-wide">
            {{ hasPassedThreshold ? '¡Suelta para calificar!' : 'Desliza más para confirmar...' }}
          </p>
        </div>
      </div>

      <!-- Tarjeta 3D Volteable -->
      <div
        :class="[
          'relative w-full h-full transition-transform duration-500 transform-style-3d rounded-3xl shadow-2xl',
          isFlipped ? 'rotate-y-180' : '',
          isDragging && activeAction ? activeAction.glowRing : '',
        ]"
      >
        <!-- FRONT OF THE CARD -->
        <div
          class="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-dark-900 to-dark-950 border border-dark-700/80 rounded-3xl p-6 flex flex-col justify-between items-center text-center shadow-xl overflow-hidden"
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
              <div class="text-7xl sm:text-8xl font-black tracking-widest text-white font-mono drop-shadow-md">
                {{ pair.pair }}
              </div>
              <p class="text-xs text-slate-500 mt-4 tracking-wider uppercase">
                Toca para ver respuesta o desliza
              </p>
            </template>

            <template v-else>
              <!-- Modo Inverso: Ver imagen/palabra primero -->
              <div v-if="pair.image" class="w-40 h-40 rounded-2xl overflow-hidden mb-3 border border-dark-700">
                <img :src="pair.image" class="w-full h-full object-cover" />
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
          <div class="w-full flex items-center justify-between text-slate-500 text-xs px-1">
            <span class="flex items-center gap-1">
              <AppIcon name="lucide:hand" :size="14" class="text-slate-400" />
              <span>Toca para voltear</span>
            </span>
            <span class="font-mono text-[10px] text-slate-500 hidden sm:inline">
              [Espacio]
            </span>
          </div>
        </div>

        <!-- BACK OF THE CARD -->
        <div
          class="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-dark-850 to-dark-900 border border-green-500/30 rounded-3xl p-5 flex flex-col justify-between items-center text-center shadow-2xl overflow-hidden"
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
              class="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border border-dark-700 bg-dark-950 mb-3 shadow-inner flex items-center justify-center"
            >
              <img
                :src="pair.image"
                alt="Mnemotecnia"
                class="w-full h-full object-contain"
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
            <span>Facilidad: {{ (card.easeFactor * 100).toFixed(0) }}%</span>
            <span>Fallos: {{ card.lapses }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
