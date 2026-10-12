<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  FACE_COLORS,
  pieceTypeOf,
  getBufferStickerInfo,
  getSchemeDuplicateStickers,
  type CubeFace,
  type LetterSchemeConfig,
} from '@/models/cube'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    scheme: LetterSchemeConfig
    cubeString?: string
    letterAtPosition?: Record<string, string>
    showLetters?: boolean
    compact?: boolean
    editable?: boolean
    showHelpBanner?: boolean
    initialShowAdjacentHints?: boolean
  }>(),
  {
    cubeString: '',
    letterAtPosition: undefined,
    showLetters: true,
    compact: false,
    editable: true,
    showHelpBanner: false,
    initialShowAdjacentHints: true,
  }
)

const showAdjacentHints = ref(props.initialShowAdjacentHints)

function toggleAdjacentHints() {
  showAdjacentHints.value = !showAdjacentHints.value
}

const FACE_OFFSET: Record<CubeFace, number> = {
  U: 0,
  R: 9,
  F: 18,
  D: 27,
  L: 36,
  B: 45,
}

function getStickerColor(face: CubeFace, index: number): { bg: string; text: string } {
  if (props.cubeString && props.cubeString.length === 54) {
    const offset = FACE_OFFSET[face]
    const colorFace = props.cubeString[offset + index] as CubeFace
    if (FACE_COLORS[colorFace]) {
      return FACE_COLORS[colorFace]
    }
  }
  return FACE_COLORS[face]
}

const emit = defineEmits<{
  (e: 'select-sticker', face: CubeFace, index: number): void
}>()

// Elemento DOM del cubo 3D para manipulaciones de GPU directas
const cubeRef = ref<HTMLDivElement | null>(null)

// Ángulos de rotación del cubo (grados)
const rotX = ref(-22)
const rotY = ref(-32)
const zoom = ref(1.0)
const isDragging = ref(false)
const isTransitioning = ref(false)
const autoSpin = ref(false)
const isFullscreen = ref(false)

let currentRotX = -22
let currentRotY = -32
let startX = 0
let startY = 0
let totalDragDistance = 0
let pointerDownSticker: { face: CubeFace; index: number } | null = null
let lastSelectTime = 0
let animFrameId: number | null = null
let pendingMoveRaf: number | null = null

// Dimensiones del cubo 3D (en píxeles)
// Cara de 204px: 3 stickers de 60px + 2 gaps de 6px + 2 paddings de 6px = 204px
const HALF_SIZE = 102

// Configuración de las 6 caras en 3D
const FACES_CONFIG: Array<{
  face: CubeFace
  name: string
  transform: string
}> = [
  { face: 'F', name: 'Front', transform: `translateZ(${HALF_SIZE}px)` },
  { face: 'B', name: 'Back', transform: `rotateY(180deg) translateZ(${HALF_SIZE}px)` },
  { face: 'R', name: 'Right', transform: `rotateY(90deg) translateZ(${HALF_SIZE}px)` },
  { face: 'L', name: 'Left', transform: `rotateY(-90deg) translateZ(${HALF_SIZE}px)` },
  { face: 'U', name: 'Up', transform: `rotateX(90deg) translateZ(${HALF_SIZE}px)` },
  { face: 'D', name: 'Down', transform: `rotateX(-90deg) translateZ(${HALF_SIZE}px)` },
]

function applyCubeTransform(rx: number, ry: number, z: number, transitioning: boolean) {
  if (!cubeRef.value) return
  cubeRef.value.style.transition = transitioning
    ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
    : 'none'
  cubeRef.value.style.transform = `scale3d(${z}, ${z}, ${z}) rotateX(${rx}deg) rotateY(${ry}deg)`
}

const FACE_NEIGHBORS: Record<CubeFace, { top: CubeFace; bottom: CubeFace; left: CubeFace; right: CubeFace }> = {
  F: { top: 'U', bottom: 'D', left: 'L', right: 'R' },
  B: { top: 'U', bottom: 'D', left: 'R', right: 'L' },
  R: { top: 'U', bottom: 'D', left: 'F', right: 'B' },
  L: { top: 'U', bottom: 'D', left: 'B', right: 'F' },
  U: { top: 'B', bottom: 'F', left: 'L', right: 'R' },
  D: { top: 'F', bottom: 'B', left: 'L', right: 'R' },
}

const STATIC_ADJACENT_MAPPING: Record<CubeFace, Record<'top' | 'bottom' | 'left' | 'right', string[]>> = {
  F: {
    top: ['U6', 'U7', 'U8'],
    bottom: ['D0', 'D1', 'D2'],
    left: ['L2', 'L5', 'L8'],
    right: ['R0', 'R3', 'R6'],
  },
  B: {
    top: ['U2', 'U1', 'U0'],
    bottom: ['D8', 'D7', 'D6'],
    left: ['R2', 'R5', 'R8'],
    right: ['L0', 'L3', 'L6'],
  },
  R: {
    top: ['U8', 'U5', 'U2'],
    bottom: ['D2', 'D5', 'D8'],
    left: ['F2', 'F5', 'F8'],
    right: ['B0', 'B3', 'B6'],
  },
  L: {
    top: ['U0', 'U3', 'U6'],
    bottom: ['D6', 'D3', 'D0'],
    left: ['B2', 'B5', 'B8'],
    right: ['F0', 'F3', 'F6'],
  },
  U: {
    top: ['B2', 'B1', 'B0'],
    bottom: ['F0', 'F1', 'F2'],
    left: ['L0', 'L1', 'L2'],
    right: ['R2', 'R1', 'R0'],
  },
  D: {
    top: ['F6', 'F7', 'F8'],
    bottom: ['B8', 'B7', 'B6'],
    left: ['L8', 'L7', 'L6'],
    right: ['R6', 'R7', 'R8'],
  },
}

export interface AdjacentTabItem {
  id: string
  face: CubeFace
  index: number
  targetFace: CubeFace
  colorBg: string
  colorText: string
  letter: string
  title: string
}

export interface FaceAdjacentTabs {
  top: AdjacentTabItem[]
  bottom: AdjacentTabItem[]
  left: AdjacentTabItem[]
  right: AdjacentTabItem[]
}

export interface StickerData {
  id: string
  face: CubeFace
  index: number
  colorBg: string
  colorText: string
  label: string
  isBuffer: boolean
  isPrimary: boolean
  badgeClass: string
  classes: string
  duplicateTitle: string
  isDuplicate: boolean
}

export interface FaceData {
  face: CubeFace
  name: string
  transform: string
  stickers: StickerData[]
  adjacentTabs: FaceAdjacentTabs
}

// Precomputar todos los datos de los 54 stickers y pestañas adyacentes de forma reactiva pero memoizada.
// Durante la rotación o arrastre orbital de la cámara, ESTA COMPUTED NO SE RE-EJECUTA.
const computedFaces = computed<FaceData[]>(() => {
  const isPracticeMode = Boolean(props.letterAtPosition)
  const dupes = !isPracticeMode ? getSchemeDuplicateStickers(props.scheme) : new Map<string, string[]>()
  const gridSize = props.scheme.gridSize || 3

  return FACES_CONFIG.map((fc) => {
    const stickers: StickerData[] = []
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const index = r * 3 + c
        const id = `${fc.face}${index}`
        const color = getStickerColor(fc.face, index)
        const bufferInfo = getBufferStickerInfo(props.scheme, id)
        const letter = props.letterAtPosition
          ? (props.letterAtPosition[id] || '')
          : (props.scheme.stickers[id] || '')
        const isDupe = !isPracticeMode && dupes.has(id)
        const conflictIds = isDupe ? (dupes.get(id) || []) : []

        if (bufferInfo.isBuffer) {
          const isCorner = bufferInfo.pieceType === 'corner'
          stickers.push({
            id,
            face: fc.face,
            index,
            colorBg: color.bg,
            colorText: color.text,
            isBuffer: true,
            isPrimary: bufferInfo.isPrimary,
            label: isPracticeMode ? letter : (bufferInfo.isPrimary ? 'BUF' : ''),
            isDuplicate: false,
            duplicateTitle: '',
            classes: isCorner
              ? 'ring-2 ring-purple-400 border-purple-300 shadow-lg shadow-purple-900/40'
              : 'ring-2 ring-green-400 border-green-300 shadow-lg shadow-green-900/40',
            badgeClass: isCorner ? 'bg-purple-600 text-white' : 'bg-green-600 text-white',
          })
        } else {
          const pType = pieceTypeOf(id, gridSize)
          const pLabel = pType === 'corner' ? 'esquinas' : 'aristas'
          stickers.push({
            id,
            face: fc.face,
            index,
            colorBg: color.bg,
            colorText: color.text,
            isBuffer: false,
            isPrimary: false,
            label: letter,
            isDuplicate: isDupe,
            duplicateTitle: isDupe
              ? `Letra repetida en ${pLabel}: también asignada en ${conflictIds.join(', ')}`
              : '',
            classes: isPracticeMode || !props.editable ? 'border-black/30' : 'border-black/30 hover:ring-2 hover:ring-white/60',
            badgeClass: '',
          })
        }
      }
    }

    const getTabsForDir = (direction: 'top' | 'bottom' | 'left' | 'right'): AdjacentTabItem[] => {
      const targetFace = FACE_NEIGHBORS[fc.face][direction]
      const stickerIds = STATIC_ADJACENT_MAPPING[fc.face][direction]
      return stickerIds.map((id) => {
        const adjFace = id[0] as CubeFace
        const adjIndex = parseInt(id.slice(1), 10)
        const color = getStickerColor(adjFace, adjIndex)
        const letter = props.letterAtPosition
          ? (props.letterAtPosition[id] || '')
          : (props.scheme.stickers[id] || '')
        const colorName = FACE_COLORS[adjFace]?.name || adjFace

        return {
          id,
          face: adjFace,
          index: adjIndex,
          targetFace,
          colorBg: color.bg,
          colorText: color.text,
          letter,
          title: `Capa adyacente: ${colorName} (${id})${letter ? ` • Letra: ${letter}` : ''} • Toca para girar hacia esta cara`,
        }
      })
    }

    const adjacentTabs: FaceAdjacentTabs = {
      top: getTabsForDir('top'),
      bottom: getTabsForDir('bottom'),
      left: getTabsForDir('left'),
      right: getTabsForDir('right'),
    }

    return {
      face: fc.face,
      name: fc.name,
      transform: fc.transform,
      stickers,
      adjacentTabs,
    }
  })
})

// Cara más frontal orientada hacia la cámara del usuario (para mostrar pistas perimetrales limpiamente)
const frontmostFace = computed<CubeFace | null>(() => {
  const rxRad = (rotX.value * Math.PI) / 180
  const ryRad = (rotY.value * Math.PI) / 180

  const zValues: Record<CubeFace, number> = {
    F: Math.cos(rxRad) * Math.cos(ryRad),
    B: -Math.cos(rxRad) * Math.cos(ryRad),
    R: -Math.cos(rxRad) * Math.sin(ryRad),
    L: Math.cos(rxRad) * Math.sin(ryRad),
    U: -Math.sin(rxRad),
    D: Math.sin(rxRad),
  }

  let maxZ = -Infinity
  let bestFace: CubeFace | null = null
  for (const fc of FACES_CONFIG) {
    const z = zValues[fc.face]
    if (z > maxZ) {
      maxZ = z
      bestFace = fc.face
    }
  }

  return maxZ > 0.35 ? bestFace : null
})

function isFaceFrontal(face: CubeFace): boolean {
  return frontmostFace.value === face
}

// Selección de sticker fiable y con debounce para evitar duplicados
function handleSelectSticker(face: CubeFace, index: number) {
  if (!props.editable || props.letterAtPosition || props.cubeString) return
  const now = Date.now()
  if (now - lastSelectTime < 300) return
  lastSelectTime = now
  emit('select-sticker', face, index)
}

function onStickerPointerDown(e: PointerEvent, face: CubeFace, index: number) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  pointerDownSticker = { face, index }
  totalDragDistance = 0
}

function onStickerClick(face: CubeFace, index: number) {
  if (totalDragDistance < 12) {
    handleSelectSticker(face, index)
  }
}

// Control de rotación por arrastre con throttle por RequestAnimationFrame
function onViewportPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return

  startX = e.clientX
  startY = e.clientY
  isDragging.value = true
  isTransitioning.value = false
  totalDragDistance = 0

  if (autoSpin.value) {
    autoSpin.value = false
    stopAutoSpin()
  }

  if (pendingMoveRaf !== null) {
    cancelAnimationFrame(pendingMoveRaf)
    pendingMoveRaf = null
  }

  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return

  const dx = e.clientX - startX
  const dy = e.clientY - startY
  startX = e.clientX
  startY = e.clientY

  const dist = Math.hypot(dx, dy)
  totalDragDistance += dist

  if (totalDragDistance > 3) {
    currentRotY += dx * 0.75
    currentRotX = Math.max(-85, Math.min(85, currentRotX - dy * 0.75))

    if (pendingMoveRaf === null) {
      pendingMoveRaf = requestAnimationFrame(() => {
        applyCubeTransform(currentRotX, currentRotY, zoom.value, false)
        rotX.value = currentRotX
        rotY.value = currentRotY
        pendingMoveRaf = null
      })
    }
  }
}

let pointerDownTabFace: CubeFace | null = null
let lastTabSnapTime = 0

function handleTabSnap(targetFace: CubeFace) {
  const now = Date.now()
  if (now - lastTabSnapTime < 350) return
  lastTabSnapTime = now
  snapToFace(targetFace)
}

function onTabPointerDown(e: PointerEvent, targetFace: CubeFace) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  pointerDownTabFace = targetFace
  totalDragDistance = 0
}

function onTabClick(targetFace: CubeFace) {
  if (totalDragDistance < 12) {
    handleTabSnap(targetFace)
  }
}

function onPointerUp() {
  if (isDragging.value) {
    isDragging.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)

    if (pendingMoveRaf !== null) {
      cancelAnimationFrame(pendingMoveRaf)
      pendingMoveRaf = null
    }

    rotX.value = currentRotX
    rotY.value = currentRotY
    applyCubeTransform(currentRotX, currentRotY, zoom.value, false)

    // Si el usuario presionó una pestaña adyacente y no arrastró (> 12px), es un toque/clic
    if (pointerDownTabFace && totalDragDistance < 12) {
      handleTabSnap(pointerDownTabFace)
    }

    // Si el usuario presionó un sticker y no arrastró (> 12px), es un toque/clic
    if (pointerDownSticker && totalDragDistance < 12) {
      handleSelectSticker(pointerDownSticker.face, pointerDownSticker.index)
    }

    setTimeout(() => {
      pointerDownSticker = null
      pointerDownTabFace = null
      totalDragDistance = 0
    }, 150)
  }
}

// Vistas predefinidas rápidas (Presets)
interface PresetView {
  label: string
  face?: CubeFace
  title: string
  rx: number
  ry: number
}

const PRESETS: PresetView[] = [
  { label: '3D', title: 'Vista Isométrica', rx: -22, ry: -32 },
  { label: 'U', face: 'U', title: 'Cara Superior (Up / Blanco)', rx: -80, ry: 0 },
  { label: 'F', face: 'F', title: 'Cara Frontal (Front / Verde)', rx: 0, ry: 0 },
  { label: 'R', face: 'R', title: 'Cara Derecha (Right / Rojo)', rx: 0, ry: -90 },
  { label: 'B', face: 'B', title: 'Cara Trasera (Back / Azul)', rx: 0, ry: 180 },
  { label: 'L', face: 'L', title: 'Cara Izquierda (Left / Naranja)', rx: 0, ry: 90 },
  { label: 'D', face: 'D', title: 'Cara Inferior (Down / Amarillo)', rx: 80, ry: 0 },
]

function snapTo(rx: number, ry: number) {
  stopAutoSpin()
  autoSpin.value = false
  isTransitioning.value = true
  currentRotX = rx
  const currentYMod = ((currentRotY % 360) + 360) % 360
  const targetYMod = ((ry % 360) + 360) % 360
  let diff = targetYMod - currentYMod
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  currentRotY = currentRotY + diff

  rotX.value = currentRotX
  rotY.value = currentRotY
  applyCubeTransform(currentRotX, currentRotY, zoom.value, true)

  setTimeout(() => {
    isTransitioning.value = false
    applyCubeTransform(currentRotX, currentRotY, zoom.value, false)
  }, 420)
}

function snapToFace(face: CubeFace) {
  const preset = PRESETS.find((p) => p.face === face)
  if (preset) {
    snapTo(preset.rx, preset.ry)
  }
}

function resetOrientation() {
  snapTo(-22, -32)
}

function toggleAutoSpin() {
  autoSpin.value = !autoSpin.value
}

function zoomIn() {
  zoom.value = Math.min(1.5, Number((zoom.value + 0.1).toFixed(1)))
}

function zoomOut() {
  zoom.value = Math.max(0.6, Number((zoom.value - 0.1).toFixed(1)))
}

watch(zoom, (newZoom) => {
  applyCubeTransform(currentRotX, currentRotY, newZoom, true)
})

function onWheel(e: WheelEvent) {
  e.preventDefault()
  if (e.deltaY < 0) {
    zoomIn()
  } else {
    zoomOut()
  }
}

// Pantalla Completa Real
function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
}

watch(isFullscreen, (active) => {
  if (active) {
    document.body.style.overflow = 'hidden'
    zoom.value = Math.max(zoom.value, 1.15)
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      try {
        document.documentElement.requestFullscreen?.().catch(() => {})
      } catch {}
    }
  } else {
    document.body.style.overflow = ''
    zoom.value = 1.0
    if (document.fullscreenElement) {
      try {
        document.exitFullscreen?.().catch(() => {})
      } catch {}
    }
  }
})

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isFullscreen.value) {
    isFullscreen.value = false
  }
}

function onFullscreenChange() {
  if (!document.fullscreenElement && isFullscreen.value) {
    isFullscreen.value = false
  }
}

function startAutoSpin() {
  if (animFrameId !== null) return
  function loop() {
    if (autoSpin.value && !isDragging.value) {
      currentRotY = (currentRotY + 0.35) % 360
      applyCubeTransform(currentRotX, currentRotY, zoom.value, false)
      animFrameId = requestAnimationFrame(loop)
    } else {
      animFrameId = null
    }
  }
  animFrameId = requestAnimationFrame(loop)
}

function stopAutoSpin() {
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId)
    animFrameId = null
  }
}

watch(autoSpin, (spinning) => {
  if (spinning) {
    startAutoSpin()
  } else {
    stopAutoSpin()
  }
})

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  applyCubeTransform(currentRotX, currentRotY, zoom.value, false)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  document.body.style.overflow = ''
  stopAutoSpin()
  if (pendingMoveRaf !== null) {
    cancelAnimationFrame(pendingMoveRaf)
  }
})

const cubeTransformStyle = computed(() => {
  return {
    transform: `scale3d(${zoom.value}, ${zoom.value}, ${zoom.value}) rotateX(${rotX.value}deg) rotateY(${rotY.value}deg)`,
    transition: isTransitioning.value ? 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
  }
})
</script>

<template>
  <Teleport to="body" :disabled="!isFullscreen">
    <div
      :class="[
        'flex flex-col items-center select-none transition-all',
        isFullscreen
          ? 'fixed inset-0 z-40 bg-dark-950 p-3 sm:p-5 flex flex-col justify-between overflow-hidden w-screen h-screen'
          : 'relative w-full',
      ]"
    >
      <!-- Barra superior de controles del visor 3D -->
      <!-- Barra superior de controles del visor 3D (Fila única compacta) -->
      <div class="w-full flex items-center justify-between gap-1.5 sm:gap-2 mb-2 sm:mb-3 px-0.5 shrink-0">
        <!-- Selector de presets de vista (3D, U, F, R, B, L, D) con scroll horizontal -->
        <div class="flex-1 min-w-0 flex items-center gap-1 bg-dark-900 border border-dark-800 p-1 rounded-xl shadow-sm overflow-x-auto no-scrollbar">
          <button
            v-for="p in PRESETS"
            :key="p.label"
            type="button"
            :class="[
              'px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0',
              p.label === '3D'
                ? 'bg-dark-800 text-green-300 hover:text-white hover:bg-dark-700'
                : 'text-slate-300 hover:text-white hover:bg-dark-800',
            ]"
            :title="p.title"
            @click="snapTo(p.rx, p.ry)"
          >
            <span
              v-if="p.face"
              class="w-2.5 h-2.5 rounded-full inline-block border border-black/40 shadow-xs"
              :style="{ backgroundColor: FACE_COLORS[p.face].bg }"
            />
            <AppIcon v-else name="lucide:box" :size="13" />
            <span>{{ p.label }}</span>
          </button>
        </div>

        <!-- Herramientas auxiliares: Capas adyacentes, Auto-giro, Reset, Zoom (- 100% +) y Pantalla Completa -->
        <div class="shrink-0 flex items-center gap-0.5 bg-dark-900 border border-dark-800 p-1 rounded-xl shadow-sm">
          <!-- Toggle pistas de capas adyacentes (estilo csTimer) -->
          <button
            type="button"
            :class="[
              'w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors shrink-0',
              showAdjacentHints
                ? 'bg-green-600/20 text-green-400 border border-green-500/30 shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-dark-800',
            ]"
            :title="showAdjacentHints ? 'Ocultar pistas de capas adyacentes' : 'Mostrar pistas de capas adyacentes (colores de las piezas en los bordes)'"
            @click="toggleAdjacentHints"
          >
            <AppIcon name="lucide:layers" :size="14" />
          </button>

          <div class="h-3.5 w-px bg-dark-800 mx-0.5 shrink-0" />

          <!-- Auto-giro -->
          <button
            type="button"
            :class="[
              'w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors shrink-0',
              autoSpin ? 'bg-green-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-dark-800',
            ]"
            title="Auto-rotación suave"
            @click="toggleAutoSpin"
          >
            <AppIcon name="lucide:rotate-cw" :size="14" />
          </button>

          <!-- Restablecer vista centrada -->
          <button
            type="button"
            class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-dark-800 transition-colors shrink-0"
            title="Restablecer vista centrada"
            @click="resetOrientation"
          >
            <AppIcon name="lucide:rotate-ccw" :size="14" />
          </button>

          <div class="h-3.5 w-px bg-dark-800 mx-0.5 shrink-0" />

          <!-- Zoom controles: Alejar, Reset al 100%, Acercar -->
          <div class="flex items-center bg-dark-950/60 rounded-lg border border-dark-800/80 px-0.5">
            <button
              type="button"
              class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-dark-800 transition-colors shrink-0"
              title="Alejar (-)"
              @click="zoomOut"
            >
              <AppIcon name="lucide:minus" :size="12" />
            </button>

            <button
              type="button"
              class="text-[10px] font-mono font-bold text-slate-300 hover:text-green-400 px-1 h-6 flex items-center justify-center transition-colors min-w-[32px] text-center"
              title="Restablecer zoom al 100%"
              @click="zoom = 1.0"
            >
              {{ Math.round(zoom * 100) }}%
            </button>

            <button
              type="button"
              class="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-dark-800 transition-colors shrink-0"
              title="Acercar (+)"
              @click="zoomIn"
            >
              <AppIcon name="lucide:plus" :size="12" />
            </button>
          </div>

          <div class="h-3.5 w-px bg-dark-800 mx-0.5 shrink-0" />

          <!-- Toggle Pantalla Completa -->
          <button
            type="button"
            :class="[
              'w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-colors shrink-0',
              isFullscreen
                ? 'bg-green-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white hover:bg-dark-800',
            ]"
            :title="isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'"
            @click="toggleFullscreen"
          >
            <AppIcon
              :name="isFullscreen ? 'lucide:minimize-2' : 'lucide:maximize-2'"
              :size="14"
            />
          </button>
        </div>
      </div>

      <!-- Escenario 3D Interactivo -->
      <div
        :class="[
          'cube-viewport relative w-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden rounded-3xl bg-gradient-to-b from-dark-900/60 to-dark-950/90 border border-dark-800/80 shadow-2xl transition-all',
          isFullscreen
            ? 'flex-1 h-full min-h-[380px]'
            : (compact ? 'h-[285px] sm:h-[325px]' : 'h-[360px] sm:h-[400px]'),
        ]"
        @pointerdown="onViewportPointerDown"
        @wheel="onWheel"
      >
        <!-- Guía de ayuda en la esquina inferior izquierda (solo si showHelpBanner es true) -->
        <div
          v-if="showHelpBanner"
          class="absolute bottom-3 left-3 flex items-center gap-1.5 text-[11px] text-slate-400 bg-dark-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-dark-800/80 pointer-events-none z-20"
        >
          <AppIcon name="lucide:move" :size="13" class-name="text-green-400 animate-pulse" />
          <span>Arrastra para rotar • Toca un sticker para editar</span>
          <span v-if="isFullscreen" class="hidden sm:inline opacity-70 ml-1">• Presiona Esc para salir</span>
        </div>

        <!-- Botón flotante para salir de pantalla completa (visible en modo fullscreen) -->
        <button
          v-if="isFullscreen"
          type="button"
          class="absolute top-3 right-3 z-30 flex items-center gap-1.5 bg-dark-900/90 hover:bg-dark-800 border border-dark-700/80 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-colors shadow-lg"
          @click="toggleFullscreen"
        >
          <AppIcon name="lucide:minimize-2" :size="14" />
          <span>Salir</span>
        </button>

        <!-- Espacio 3D con perspectiva -->
        <div class="scene-wrap">
          <div
            ref="cubeRef"
            class="cube-3d"
            :style="cubeTransformStyle"
          >
            <!-- Núcleo interior negro del speedcube -->
            <div class="cube-core" />

            <!-- Las 6 caras exteriores del cubo (Precomputadas para evitar re-cálculos en drag) -->
            <div
              v-for="fc in computedFaces"
              :key="fc.face"
              class="cube-face"
              :style="{ transform: fc.transform }"
            >
              <!-- Pistas perimetrales de capas adyacentes (estilo csTimer) -->
              <template v-if="showAdjacentHints && isFaceFrontal(fc.face)">
                <!-- Barra Superior (Top) -->
                <div class="adjacent-tabs-top">
                  <div
                    v-for="tab in fc.adjacentTabs.top"
                    :key="tab.id"
                    class="adjacent-tab adjacent-tab-top"
                    :style="{ backgroundColor: tab.colorBg, color: tab.colorText }"
                    :title="tab.title"
                    @pointerdown="onTabPointerDown($event, tab.targetFace)"
                    @click="onTabClick(tab.targetFace)"
                  >
                    <span v-if="showLetters && tab.letter" class="adjacent-tab-letter">
                      {{ tab.letter }}
                    </span>
                  </div>
                </div>
                <!-- Barra Inferior (Bottom) -->
                <div class="adjacent-tabs-bottom">
                  <div
                    v-for="tab in fc.adjacentTabs.bottom"
                    :key="tab.id"
                    class="adjacent-tab adjacent-tab-bottom"
                    :style="{ backgroundColor: tab.colorBg, color: tab.colorText }"
                    :title="tab.title"
                    @pointerdown="onTabPointerDown($event, tab.targetFace)"
                    @click="onTabClick(tab.targetFace)"
                  >
                    <span v-if="showLetters && tab.letter" class="adjacent-tab-letter">
                      {{ tab.letter }}
                    </span>
                  </div>
                </div>
                <!-- Barra Izquierda (Left) -->
                <div class="adjacent-tabs-left">
                  <div
                    v-for="tab in fc.adjacentTabs.left"
                    :key="tab.id"
                    class="adjacent-tab adjacent-tab-left"
                    :style="{ backgroundColor: tab.colorBg, color: tab.colorText }"
                    :title="tab.title"
                    @pointerdown="onTabPointerDown($event, tab.targetFace)"
                    @click="onTabClick(tab.targetFace)"
                  >
                    <span v-if="showLetters && tab.letter" class="adjacent-tab-letter">
                      {{ tab.letter }}
                    </span>
                  </div>
                </div>
                <!-- Barra Derecha (Right) -->
                <div class="adjacent-tabs-right">
                  <div
                    v-for="tab in fc.adjacentTabs.right"
                    :key="tab.id"
                    class="adjacent-tab adjacent-tab-right"
                    :style="{ backgroundColor: tab.colorBg, color: tab.colorText }"
                    :title="tab.title"
                    @pointerdown="onTabPointerDown($event, tab.targetFace)"
                    @click="onTabClick(tab.targetFace)"
                  >
                    <span v-if="showLetters && tab.letter" class="adjacent-tab-letter">
                      {{ tab.letter }}
                    </span>
                  </div>
                </div>
              </template>

              <!-- Cuadrícula 3x3 de stickers -->
              <div class="face-grid">
                <button
                  v-for="s in fc.stickers"
                  :key="s.id"
                  type="button"
                  class="sticker-btn group"
                  :class="s.classes"
                  :style="{
                    backgroundColor: s.colorBg,
                    color: s.colorText,
                  }"
                  :title="s.duplicateTitle || undefined"
                  @pointerdown="onStickerPointerDown($event, s.face, s.index)"
                  @click="onStickerClick(s.face, s.index)"
                >
                  <!-- Modo Buffer Activo (solo en editor de esquemas sin letterAtPosition) -->
                  <template v-if="showLetters && !letterAtPosition && s.isPrimary && s.isBuffer">
                    <span
                      class="text-[10px] font-black uppercase px-1 py-0.5 rounded leading-none shadow-sm pointer-events-none"
                      :class="s.badgeClass"
                    >
                      BUF
                    </span>
                  </template>
                  <!-- Letra asignada -->
                  <template v-else-if="showLetters">
                    <span
                      :class="[
                        'text-base sm:text-lg font-black font-mono leading-none tracking-tight drop-shadow-xs pointer-events-none',
                        s.isDuplicate
                          ? (s.face === 'R'
                              ? 'underline decoration-red-300 decoration-[2.5px] underline-offset-[3px]'
                              : 'underline decoration-red-500 decoration-[2.5px] underline-offset-[3px]')
                          : '',
                      ]"
                    >
                      {{ s.label }}
                    </span>
                  </template>

                  <!-- Identificador de posición (ej: U0, F4) -->
                  <span
                    v-if="showLetters"
                    class="text-[8px] font-sans font-semibold opacity-60 leading-none mt-0.5 pointer-events-none"
                  >
                    {{ s.id }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cube-viewport {
  touch-action: none;
}

.scene-wrap {
  perspective: 900px;
  perspective-origin: 50% 50%;
  width: 204px;
  height: 204px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cube-3d {
  width: 204px;
  height: 204px;
  position: relative;
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
  transform-origin: 50% 50% 50%;
  will-change: transform;
}

/* Núcleo interior negro del speedcube */
.cube-core {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 198px;
  height: 198px;
  margin-top: -99px;
  margin-left: -99px;
  background-color: #09090b;
  border-radius: 14px;
  transform: translateZ(0);
  pointer-events: none;
}

/* Estructura de cada cara (204px x 204px) */
.cube-face {
  position: absolute;
  top: 0;
  left: 0;
  width: 204px;
  height: 204px;
  transform-style: preserve-3d;
  -webkit-transform-style: preserve-3d;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  background: #18181b;
  border: 2px solid #27272a;
  border-radius: 14px;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.7);
  padding: 5px;
  box-sizing: border-box;
}

/* Cuadrícula 3x3 de cada cara */
.face-grid {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 5px;
}

/* Estilos de cada botón/sticker */
.sticker-btn {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border-width: 1.5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  box-shadow:
    inset 0 1px 2px rgba(255, 255, 255, 0.35),
    inset 0 -1px 2px rgba(0, 0, 0, 0.4),
    0 1px 3px rgba(0, 0, 0, 0.3);
  user-select: none;
  -webkit-user-select: none;
}

/* Solo aplicar hover/active transform en dispositivos que tienen puntero preciso (mouse) */
@media (hover: hover) and (pointer: fine) {
  .sticker-btn:hover {
    filter: brightness(1.1);
    transform: scale(1.04);
  }
}

.sticker-btn:active {
  transform: scale(0.96);
}

/* Pistas perimetrales de capas adyacentes (estilo csTimer / BLD) */
.adjacent-tabs-top {
  position: absolute;
  top: -13px;
  left: 7px;
  width: 190px;
  height: 10px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  transform: translateZ(1px);
  pointer-events: auto;
  z-index: 10;
}

.adjacent-tabs-bottom {
  position: absolute;
  bottom: -13px;
  left: 7px;
  width: 190px;
  height: 10px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  transform: translateZ(1px);
  pointer-events: auto;
  z-index: 10;
}

.adjacent-tabs-left {
  position: absolute;
  top: 7px;
  left: -13px;
  width: 10px;
  height: 190px;
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: 5px;
  transform: translateZ(1px);
  pointer-events: auto;
  z-index: 10;
}

.adjacent-tabs-right {
  position: absolute;
  top: 7px;
  right: -13px;
  width: 10px;
  height: 190px;
  display: grid;
  grid-template-rows: repeat(3, 1fr);
  gap: 5px;
  transform: translateZ(1px);
  pointer-events: auto;
  z-index: 10;
}

.adjacent-tab {
  cursor: pointer;
  transition: transform 0.15s ease, filter 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  -webkit-user-select: none;
}

@media (hover: hover) and (pointer: fine) {
  .adjacent-tab:hover {
    filter: brightness(1.2);
    transform: scale(1.08);
  }
}

.adjacent-tab:active {
  transform: scale(0.95);
}

.adjacent-tab-top {
  border-radius: 4px 4px 1px 1px;
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.4);
  border-top: 1px solid rgba(255, 255, 255, 0.3);
  border-left: 1px solid rgba(0, 0, 0, 0.4);
  border-right: 1px solid rgba(0, 0, 0, 0.4);
}

.adjacent-tab-bottom {
  border-radius: 1px 1px 4px 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4), inset 0 -1px 1px rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(0, 0, 0, 0.6);
  border-left: 1px solid rgba(0, 0, 0, 0.4);
  border-right: 1px solid rgba(0, 0, 0, 0.4);
}

.adjacent-tab-left {
  border-radius: 4px 1px 1px 4px;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.4), inset 1px 0 1px rgba(255, 255, 255, 0.3);
  border-left: 1px solid rgba(255, 255, 255, 0.3);
  border-top: 1px solid rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(0, 0, 0, 0.4);
}

.adjacent-tab-right {
  border-radius: 1px 4px 4px 1px;
  box-shadow: 2px 0 4px rgba(0, 0, 0, 0.4), inset -1px 0 1px rgba(0, 0, 0, 0.3);
  border-right: 1px solid rgba(0, 0, 0, 0.6);
  border-top: 1px solid rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(0, 0, 0, 0.4);
}

.adjacent-tab-letter {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 900;
  font-size: 8px;
  line-height: 1;
  pointer-events: none;
  opacity: 0.95;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}
</style>
