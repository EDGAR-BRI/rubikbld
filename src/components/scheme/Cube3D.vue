<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  FACE_COLORS,
  getBufferStickerInfo,
  type CubeFace,
  type LetterSchemeConfig,
} from '@/models/cube'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{
  scheme: LetterSchemeConfig
}>()

const emit = defineEmits<{
  (e: 'select-sticker', face: CubeFace, index: number): void
}>()

// Ángulos de rotación del cubo (grados)
const rotX = ref(-22)
const rotY = ref(-32)
const zoom = ref(1.0)
const isDragging = ref(false)
const isTransitioning = ref(false)
const autoSpin = ref(false)
const isFullscreen = ref(false)

let startX = 0
let startY = 0
let totalDragDistance = 0
let pointerDownSticker: { face: CubeFace; index: number } | null = null
let lastSelectTime = 0
let animFrameId: number | null = null

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

// Mapeo matemático exacto de coordenadas (col 0..2, row 0..2) a índice 0..8
function getStickerIndex(face: CubeFace, col: number, row: number): number {
  let r = row
  let c = col
  if (face === 'B') {
    c = 2 - col // Invertir columnas en B para alinear B0 con L y B2 con R
  }
  if (face === 'D') {
    r = 2 - row // Invertir filas en D para alinear D0..D2 con B y D6..D8 con F
  }
  return r * 3 + c
}

function getStickerDisplay(id: string) {
  const bufferInfo = getBufferStickerInfo(props.scheme, id)
  const letter = props.scheme.stickers[id] || ''

  if (bufferInfo.isBuffer) {
    const isCorner = bufferInfo.pieceType === 'corner'
    return {
      isBuffer: true,
      pieceType: bufferInfo.pieceType,
      isPrimary: bufferInfo.isPrimary,
      label: bufferInfo.isPrimary ? 'BUF' : '',
      classes: isCorner
        ? 'ring-2 ring-purple-400 border-purple-300 shadow-lg shadow-purple-900/40'
        : 'ring-2 ring-indigo-400 border-indigo-300 shadow-lg shadow-indigo-900/40',
      badgeClass: isCorner ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white',
    }
  }

  return {
    isBuffer: false,
    pieceType: null,
    isPrimary: false,
    label: letter,
    classes: 'border-black/30 hover:ring-2 hover:ring-white/60',
    badgeClass: '',
  }
}

// Selección de sticker fiable y con debounce para evitar duplicados
function handleSelectSticker(face: CubeFace, index: number) {
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

// Control de rotación por arrastre (Pointer Events en ventana)
function onViewportPointerDown(e: PointerEvent) {
  if (e.button !== 0 && e.pointerType === 'mouse') return

  startX = e.clientX
  startY = e.clientY
  isDragging.value = true
  isTransitioning.value = false
  totalDragDistance = 0

  if (autoSpin.value) {
    autoSpin.value = false
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return

  const dx = e.clientX - startX
  const dy = e.clientY - startY
  const dist = Math.hypot(dx, dy)
  totalDragDistance += dist

  // Rotar el cubo si el desplazamiento supera el umbral de toque
  if (totalDragDistance > 3) {
    rotY.value += dx * 0.75
    rotX.value = Math.max(-85, Math.min(85, rotX.value - dy * 0.75))
    startX = e.clientX
    startY = e.clientY
  }
}

function onPointerUp() {
  if (isDragging.value) {
    isDragging.value = false
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)

    // Si el usuario presionó un sticker y no arrastró (> 12px), es un toque/clic
    if (pointerDownSticker && totalDragDistance < 12) {
      handleSelectSticker(pointerDownSticker.face, pointerDownSticker.index)
    }

    setTimeout(() => {
      pointerDownSticker = null
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
  isTransitioning.value = true
  autoSpin.value = false
  rotX.value = rx
  const currentYMod = ((rotY.value % 360) + 360) % 360
  const targetYMod = ((ry % 360) + 360) % 360
  let diff = targetYMod - currentYMod
  if (diff > 180) diff -= 360
  if (diff < -180) diff += 360
  rotY.value = rotY.value + diff

  setTimeout(() => {
    isTransitioning.value = false
  }, 420)
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
    // Intentar activar Fullscreen API del navegador si está soportado
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

// Bucle de animación para auto-giro suave
function stepAnimation() {
  if (autoSpin.value && !isDragging.value) {
    rotY.value = (rotY.value + 0.35) % 360
  }
  animFrameId = requestAnimationFrame(stepAnimation)
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  animFrameId = requestAnimationFrame(stepAnimation)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerUp)
  document.body.style.overflow = ''
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId)
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
      <div class="w-full flex flex-wrap items-center justify-between gap-2 mb-3 px-1 shrink-0">
        <!-- Selector de presets de vista (3D, U, F, R, B, L, D) -->
        <div class="flex items-center gap-1 bg-dark-900 border border-dark-800 p-1 rounded-xl shadow-sm overflow-x-auto no-scrollbar">
          <button
            v-for="p in PRESETS"
            :key="p.label"
            type="button"
            :class="[
              'px-2 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0',
              p.label === '3D'
                ? 'bg-dark-800 text-indigo-300 hover:text-white hover:bg-dark-700'
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

        <!-- Herramientas auxiliares: Auto-giro, Zoom, Centrar y Pantalla Completa -->
        <div class="flex items-center gap-1 bg-dark-900 border border-dark-800 p-1 rounded-xl shadow-sm">
          <button
            type="button"
            :class="[
              'p-1.5 rounded-lg text-xs transition-colors',
              autoSpin ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white',
            ]"
            title="Auto-rotación suave"
            @click="toggleAutoSpin"
          >
            <AppIcon name="lucide:rotate-cw" :size="15" />
          </button>

          <div class="h-4 w-px bg-dark-800 mx-0.5" />

          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Alejar (-)"
            @click="zoomOut"
          >
            <AppIcon name="lucide:minus" :size="15" />
          </button>

          <span class="text-[10px] font-mono text-slate-400 px-0.5 min-w-[28px] text-center">
            {{ Math.round(zoom * 100) }}%
          </span>

          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Acercar (+)"
            @click="zoomIn"
          >
            <AppIcon name="lucide:plus" :size="15" />
          </button>

          <div class="h-4 w-px bg-dark-800 mx-0.5" />

          <!-- Centrar vista / reset de orientación -->
          <button
            type="button"
            class="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Restablecer vista centrada"
            @click="resetOrientation"
          >
            <AppIcon name="lucide:rotate-ccw" :size="15" />
          </button>

          <!-- Toggle Pantalla Completa -->
          <button
            type="button"
            :class="[
              'p-1.5 rounded-lg text-xs transition-colors',
              isFullscreen
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white',
            ]"
            :title="isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'"
            @click="toggleFullscreen"
          >
            <AppIcon
              :name="isFullscreen ? 'lucide:minimize-2' : 'lucide:maximize-2'"
              :size="15"
            />
          </button>
        </div>
      </div>

      <!-- Escenario 3D Interactivo -->
      <div
        :class="[
          'cube-viewport relative w-full flex items-center justify-center cursor-grab active:cursor-grabbing overflow-hidden rounded-3xl bg-gradient-to-b from-dark-900/60 to-dark-950/90 border border-dark-800/80 shadow-2xl transition-all',
          isFullscreen ? 'flex-1 h-full min-h-[380px]' : 'h-[360px] sm:h-[400px]',
        ]"
        @pointerdown="onViewportPointerDown"
        @wheel="onWheel"
      >
        <!-- Guía de ayuda en la esquina inferior izquierda -->
        <div class="absolute bottom-3 left-3 flex items-center gap-1.5 text-[11px] text-slate-400 bg-dark-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-dark-800/80 pointer-events-none z-20">
          <AppIcon name="lucide:move" :size="13" class-name="text-indigo-400 animate-pulse" />
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
          <div class="cube-3d" :style="cubeTransformStyle">
            <!-- Núcleo interior negro del speedcube -->
            <div class="cube-core" />

            <!-- Las 6 caras exteriores del cubo -->
            <div
              v-for="fc in FACES_CONFIG"
              :key="fc.face"
              class="cube-face"
              :style="{ transform: fc.transform }"
            >
              <!-- Cuadrícula 3x3 de stickers -->
              <div class="face-grid">
                <template v-for="r in 3" :key="`r-${r}`">
                  <button
                    v-for="c in 3"
                    :key="`s-${fc.face}-${getStickerIndex(fc.face, c - 1, r - 1)}`"
                    type="button"
                    class="sticker-btn group"
                    :class="getStickerDisplay(`${fc.face}${getStickerIndex(fc.face, c - 1, r - 1)}`).classes"
                    :style="{
                      backgroundColor: FACE_COLORS[fc.face].bg,
                      color: FACE_COLORS[fc.face].text,
                    }"
                    @pointerdown="onStickerPointerDown($event, fc.face, getStickerIndex(fc.face, c - 1, r - 1))"
                    @click="onStickerClick(fc.face, getStickerIndex(fc.face, c - 1, r - 1))"
                  >
                    <!-- Modo Buffer Activo (solo el sticker seleccionado como buffer) -->
                    <template v-if="getStickerDisplay(`${fc.face}${getStickerIndex(fc.face, c - 1, r - 1)}`).isPrimary">
                      <span
                        class="text-[10px] font-black uppercase px-1 py-0.5 rounded leading-none shadow-sm pointer-events-none"
                        :class="getStickerDisplay(`${fc.face}${getStickerIndex(fc.face, c - 1, r - 1)}`).badgeClass"
                      >
                        BUF
                      </span>
                    </template>
                    <!-- Letra asignada -->
                    <template v-else>
                      <span class="text-base sm:text-lg font-black font-mono leading-none tracking-tight drop-shadow-xs pointer-events-none">
                        {{ getStickerDisplay(`${fc.face}${getStickerIndex(fc.face, c - 1, r - 1)}`).label }}
                      </span>
                    </template>

                    <!-- Identificador de posición (ej: U0, F4) -->
                    <span class="text-[8px] font-sans font-semibold opacity-60 leading-none mt-0.5 pointer-events-none">
                      {{ fc.face }}{{ getStickerIndex(fc.face, c - 1, r - 1) }}
                    </span>
                  </button>
                </template>
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
  backface-visibility: hidden;
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
    0 2px 4px rgba(0, 0, 0, 0.3);
  transition: transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease;
  user-select: none;
  -webkit-user-select: none;
}

.sticker-btn:hover {
  filter: brightness(1.1);
  transform: scale(1.04);
}

.sticker-btn:active {
  transform: scale(0.96);
}
</style>
