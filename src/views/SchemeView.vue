<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { useSchemeStore } from '@/stores/useSchemeStore'
import {
  FACE_COLORS,
  pieceTypeOf,
  getPieceName,
  getPieceStickers,
  getBufferStickerInfo,
  type CubeFace,
} from '@/models/cube'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import RubikLoader from '@/components/RubikLoader.vue'
import Cube3D from '@/components/scheme/Cube3D.vue'
import { showSuccessToast, confirmResetScheme } from '@/utils/alerts'

const schemeStore = useSchemeStore()

// En el despliegue 2D, la cara D (abajo) conecta con la cara F por su fila superior (DFL=D6, DF=D7, DFR=D8).
// Invertimos las filas para que el buffer DF (D7) y las esquinas (D6, D8) toquen directamente con la cara F.
const D_FACE_STICKER_ORDER = [6, 7, 8, 3, 4, 5, 0, 1, 2]

const viewMode = ref<'2d' | '3d'>(
  (localStorage.getItem('rubik_scheme_view') as '2d' | '3d') || '2d',
)

watch(viewMode, (newVal) => {
  localStorage.setItem('rubik_scheme_view', newVal)
})

const selectedSticker = ref<{
  id: string
  face: CubeFace
  index: number
  letter: string
  type: string
  isBuffer: boolean
  isPrimaryBuffer: boolean
  bufferType: 'corner' | 'edge' | null
  pieceName: string
  pieceStickers: string[]
} | null>(null)

const editLetterInput = ref('')
const showStickerModal = ref(false)
const letterInputRef = ref<InstanceType<typeof AppInput> | null>(null)

onMounted(async () => {
  await schemeStore.loadScheme()
})

function getStickerDisplay(id: string) {
  const bufferInfo = getBufferStickerInfo(schemeStore.currentScheme, id)
  const letter = schemeStore.currentScheme.stickers[id] || ''

  if (bufferInfo.isBuffer) {
    const isCorner = bufferInfo.pieceType === 'corner'
    return {
      isBuffer: true,
      pieceType: bufferInfo.pieceType,
      isPrimary: bufferInfo.isPrimary,
      label: bufferInfo.isPrimary ? 'BUF' : '',
      classes: isCorner
        ? 'border-purple-400 ring-2 ring-purple-400/50 shadow-purple-900/20'
        : 'border-indigo-400 ring-2 ring-indigo-400/50 shadow-indigo-900/20',
      badgeClass: isCorner ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white',
    }
  }

  return {
    isBuffer: false,
    pieceType: null,
    isPrimary: false,
    label: letter,
    classes: 'border-slate-300/40',
    badgeClass: '',
  }
}

function openSticker(face: CubeFace, index: number) {
  const id = `${face}${index}`
  const letter = schemeStore.currentScheme.stickers[id] || ''
  const type = pieceTypeOf(id, 3)
  const bufferInfo = getBufferStickerInfo(schemeStore.currentScheme, id)

  selectedSticker.value = {
    id,
    face,
    index,
    letter,
    type,
    isBuffer: bufferInfo.isBuffer,
    isPrimaryBuffer: bufferInfo.isPrimary,
    bufferType: bufferInfo.pieceType,
    pieceName: bufferInfo.pieceName,
    pieceStickers: bufferInfo.pieceStickers,
  }
  editLetterInput.value = letter
  showStickerModal.value = true

  if (!bufferInfo.isBuffer) {
    nextTick(() => {
      letterInputRef.value?.focus()
      letterInputRef.value?.select()
    })
    setTimeout(() => {
      letterInputRef.value?.focus()
      letterInputRef.value?.select()
    }, 60)
  }
}

async function saveStickerLetter() {
  if (!selectedSticker.value) return
  const stickerId = selectedSticker.value.id
  const letterVal = editLetterInput.value.trim().toUpperCase()

  showStickerModal.value = false

  await schemeStore.updateSticker(stickerId, letterVal)
  showSuccessToast(
    `Sticker ${stickerId} guardado`,
    letterVal ? `Letra asignada: "${letterVal}"` : 'Sin letra asignada',
  )
}

async function setAsBuffer(type: 'corner' | 'edge') {
  if (!selectedSticker.value) return
  const stickerId = selectedSticker.value.id
  const label = type === 'corner' ? 'Esquinas' : 'Aristas'

  showStickerModal.value = false

  await schemeStore.updateBuffer(type, stickerId)

  showSuccessToast(
    `Buffer de ${label} actualizado`,
    `Pieza asignada a ${stickerId}. Todas las caras de esta pieza quedaron sin letra.`,
  )
}

async function onResetSpeffz() {
  const result = await confirmResetScheme()
  if (result.isConfirmed) {
    await schemeStore.resetToSpeffz()
    showSuccessToast('Esquema restablecido', 'Se cargó el patrón estándar Speffz')
  }
}

function openBuffer(type: 'corner' | 'edge') {
  const stickerId = schemeStore.currentScheme?.buffers?.[type]
  if (!stickerId) return
  const face = stickerId[0] as CubeFace
  const index = parseInt(stickerId.slice(1), 10)
  if (!isNaN(index) && FACE_COLORS[face]) {
    openSticker(face, index)
  }
}

function getOrderedBufferStickers(stickerId: string): string[] {
  if (!stickerId) return []
  const stickers = getPieceStickers(stickerId, schemeStore.currentScheme.gridSize || 3)
  return [stickerId, ...stickers.filter(s => s !== stickerId)]
}

function getFaceColor(stickerId: string) {
  const face = stickerId[0] as CubeFace
  return FACE_COLORS[face] || { bg: '#334155', text: '#ffffff', name: '' }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full overflow-hidden bg-dark-950">
    <AppHeader
      title="Esquema del Cubo"
      :subtitle="viewMode === '3d' ? 'Vista 3D interactiva y editable' : 'Configura tus letras y buffers'"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <!-- Switch Vista 2D / 3D con estilo idéntico al de Pares -->
          <div class="flex items-center bg-dark-900 border border-dark-800 p-0.5 rounded-xl">
            <button
              type="button"
              :class="[
                'p-1.5 rounded-lg transition-colors flex items-center gap-1.5 px-2.5',
                viewMode === '2d' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white',
              ]"
              title="Vista 2D Desplegada"
              @click="viewMode = '2d'"
            >
              <AppIcon name="lucide:grid-2x2" :size="15" />
              <span class="text-xs font-semibold">2D</span>
            </button>
            <button
              type="button"
              :class="[
                'p-1.5 rounded-lg transition-colors flex items-center gap-1.5 px-2.5',
                viewMode === '3d' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white',
              ]"
              title="Vista 3D Interactiva"
              @click="viewMode = '3d'"
            >
              <AppIcon name="lucide:box" :size="15" />
              <span class="text-xs font-semibold">3D</span>
            </button>
          </div>

          <AppButton
            size="sm"
            variant="outline"
            icon="lucide:rotate-ccw"
            @click="onResetSpeffz"
          >
            Speffz
          </AppButton>
        </div>
      </template>
    </AppHeader>

    <div v-if="schemeStore.loading" class="flex-1 flex items-center justify-center p-4">
      <RubikLoader label="Cargando esquema del cubo..." />
    </div>
    <div v-else class="flex-1 overflow-y-auto p-4 max-w-lg mx-auto w-full">
      <!-- Tarjetas de buffers activos -->
      <div class="grid grid-cols-2 gap-3 mb-6">
        <!-- Buffer Esquinas -->
        <button
          type="button"
          class="text-left bg-gradient-to-br from-purple-950/40 via-dark-900 to-dark-950 border border-purple-500/25 hover:border-purple-400/50 rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between transition-all duration-200 active:scale-[0.98] shadow-lg shadow-purple-950/20 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/40"
          title="Toca para ver o configurar el buffer de esquinas"
          @click="openBuffer('corner')"
        >
          <!-- Efecto de brillo de fondo -->
          <div class="absolute -top-10 -right-10 w-24 h-24 bg-purple-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-purple-500/20 transition-colors"></div>

          <div>
            <!-- Header de la tarjeta -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <span class="w-6 h-6 rounded-lg bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-xs">
                  <AppIcon name="lucide:box" :size="13" />
                </span>
                <div>
                  <span class="text-[9px] font-black uppercase tracking-wider text-purple-400 block leading-tight">Buffer</span>
                  <span class="text-xs font-bold text-slate-200 block leading-tight">Esquinas</span>
                </div>
              </div>
              <span class="w-5 h-5 rounded-md flex items-center justify-center text-slate-500 group-hover:text-purple-300 transition-colors">
                <AppIcon name="lucide:sliders-horizontal" :size="12" />
              </span>
            </div>

            <!-- Identificador de la pieza -->
            <div class="flex items-baseline gap-2 mt-1">
              <span class="font-mono font-black text-xl text-white tracking-wide">
                {{ getPieceName(schemeStore.currentScheme.buffers.corner) }}
              </span>
              <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/25">
                Base: {{ schemeStore.currentScheme.buffers.corner }}
              </span>
            </div>
          </div>

          <!-- Stickers físicos de la pieza con sus colores reales -->
          <div class="mt-3 pt-2 border-t border-purple-500/15 flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Caras</span>
              <span class="text-[9px] text-amber-400 font-mono flex items-center gap-0.5">
                <span>★</span> disparo
              </span>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span
                v-for="sId in getOrderedBufferStickers(schemeStore.currentScheme.buffers.corner)"
                :key="sId"
                class="px-2 py-0.5 rounded-md text-[11px] font-mono font-black flex items-center gap-1 shadow-sm border border-black/25 transition-transform group-hover:scale-105"
                :style="{
                  backgroundColor: getFaceColor(sId).bg,
                  color: getFaceColor(sId).text
                }"
              >
                <span
                  v-if="sId === schemeStore.currentScheme.buffers.corner"
                  class="text-[9px] leading-none text-amber-500 drop-shadow-xs"
                >★</span>
                <span>{{ sId }}</span>
              </span>
            </div>
          </div>
        </button>

        <!-- Buffer Aristas -->
        <button
          type="button"
          class="text-left bg-gradient-to-br from-indigo-950/40 via-dark-900 to-dark-950 border border-indigo-500/25 hover:border-indigo-400/50 rounded-2xl p-3.5 relative overflow-hidden flex flex-col justify-between transition-all duration-200 active:scale-[0.98] shadow-lg shadow-indigo-950/20 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
          title="Toca para ver o configurar el buffer de aristas"
          @click="openBuffer('edge')"
        >
          <!-- Efecto de brillo de fondo -->
          <div class="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none group-hover:bg-indigo-500/20 transition-colors"></div>

          <div>
            <!-- Header de la tarjeta -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <span class="w-6 h-6 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xs">
                  <AppIcon name="lucide:split" :size="13" />
                </span>
                <div>
                  <span class="text-[9px] font-black uppercase tracking-wider text-indigo-400 block leading-tight">Buffer</span>
                  <span class="text-xs font-bold text-slate-200 block leading-tight">Aristas</span>
                </div>
              </div>
              <span class="w-5 h-5 rounded-md flex items-center justify-center text-slate-500 group-hover:text-indigo-300 transition-colors">
                <AppIcon name="lucide:sliders-horizontal" :size="12" />
              </span>
            </div>

            <!-- Identificador de la pieza -->
            <div class="flex items-baseline gap-2 mt-1">
              <span class="font-mono font-black text-xl text-white tracking-wide">
                {{ getPieceName(schemeStore.currentScheme.buffers.edge) }}
              </span>
              <span class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                Base: {{ schemeStore.currentScheme.buffers.edge }}
              </span>
            </div>
          </div>

          <!-- Stickers físicos de la pieza con sus colores reales -->
          <div class="mt-3 pt-2 border-t border-indigo-500/15 flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-[10px] text-slate-400 font-medium">
              <span>Caras</span>
              <span class="text-[9px] text-amber-400 font-mono flex items-center gap-0.5">
                <span>★</span> disparo
              </span>
            </div>
            <div class="flex items-center gap-1.5 flex-wrap">
              <span
                v-for="sId in getOrderedBufferStickers(schemeStore.currentScheme.buffers.edge)"
                :key="sId"
                class="px-2 py-0.5 rounded-md text-[11px] font-mono font-black flex items-center gap-1 shadow-sm border border-black/25 transition-transform group-hover:scale-105"
                :style="{
                  backgroundColor: getFaceColor(sId).bg,
                  color: getFaceColor(sId).text
                }"
              >
                <span
                  v-if="sId === schemeStore.currentScheme.buffers.edge"
                  class="text-[9px] leading-none text-amber-500 drop-shadow-xs"
                >★</span>
                <span>{{ sId }}</span>
              </span>
            </div>
          </div>
        </button>
      </div>

      <!-- VISTA 2D: Despliegue plano tradicional del Cubo -->
      <div v-if="viewMode === '2d'">
        <p class="text-xs text-slate-400 mb-4 text-center">
          Toca cualquier sticker del cubo para editar su letra o asignarlo como buffer:
        </p>

        <!-- Despliegue 2D del Cubo (U arriba, L-F-R-B en fila, D abajo) -->
        <div class="flex flex-col items-center gap-3">
          <!-- Cara U (Arriba) -->
          <div class="flex flex-col items-center">
            <span class="text-[11px] font-semibold text-slate-400 mb-1">
              {{ FACE_COLORS['U'].name }}
            </span>
            <div class="grid grid-cols-3 gap-1.5 p-2 bg-dark-900 border border-dark-800 rounded-2xl shadow-md">
              <button
                v-for="idx in 9"
                :key="`U${idx-1}`"
                type="button"
                :class="[
                  'w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-sm transition-transform active:scale-90 border',
                  getStickerDisplay(`U${idx-1}`).classes,
                ]"
                :style="{ backgroundColor: FACE_COLORS['U'].bg, color: FACE_COLORS['U'].text }"
                @click="openSticker('U', idx-1)"
              >
                <template v-if="getStickerDisplay(`U${idx-1}`).isPrimary">
                  <span :class="['text-[9px] font-black uppercase px-1 py-0.5 rounded leading-none', getStickerDisplay(`U${idx-1}`).badgeClass]">
                    BUF
                  </span>
                </template>
                <template v-else>
                  <span>{{ getStickerDisplay(`U${idx-1}`).label }}</span>
                </template>
                <span class="text-[8px] opacity-60 font-sans">U{{ idx-1 }}</span>
              </button>
            </div>
          </div>

          <!-- Fila central: L, F, R, B con scroll horizontal cómodo -->
          <div class="w-full overflow-x-auto pb-2">
            <div class="flex items-center justify-center gap-2 min-w-max px-2">
              <div
                v-for="face in (['L', 'F', 'R', 'B'] as CubeFace[])"
                :key="face"
                class="flex flex-col items-center"
              >
                <span class="text-[11px] font-semibold text-slate-400 mb-1">
                  {{ FACE_COLORS[face].name }}
                </span>
                <div class="grid grid-cols-3 gap-1.5 p-2 bg-dark-900 border border-dark-800 rounded-2xl shadow-md">
                  <button
                    v-for="idx in 9"
                    :key="`${face}${idx-1}`"
                    type="button"
                    :class="[
                      'w-10 h-10 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-sm transition-transform active:scale-90 border',
                      getStickerDisplay(`${face}${idx-1}`).classes,
                    ]"
                    :style="{ backgroundColor: FACE_COLORS[face].bg, color: FACE_COLORS[face].text }"
                    @click="openSticker(face, idx-1)"
                  >
                    <template v-if="getStickerDisplay(`${face}${idx-1}`).isPrimary">
                      <span :class="['text-[8px] font-black uppercase px-1 py-0.5 rounded leading-none', getStickerDisplay(`${face}${idx-1}`).badgeClass]">
                        BUF
                      </span>
                    </template>
                    <template v-else>
                      <span>{{ getStickerDisplay(`${face}${idx-1}`).label }}</span>
                    </template>
                    <span class="text-[8px] opacity-70 font-sans">{{ face }}{{ idx-1 }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Cara D (Abajo) -->
          <div class="flex flex-col items-center">
            <span class="text-[11px] font-semibold text-slate-400 mb-1">
              {{ FACE_COLORS['D'].name }}
            </span>
            <div class="grid grid-cols-3 gap-1.5 p-2 bg-dark-900 border border-dark-800 rounded-2xl shadow-md">
              <button
                v-for="sIdx in D_FACE_STICKER_ORDER"
                :key="`D${sIdx}`"
                type="button"
                :class="[
                  'w-11 h-11 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-sm transition-transform active:scale-90 border',
                  getStickerDisplay(`D${sIdx}`).classes,
                ]"
                :style="{ backgroundColor: FACE_COLORS['D'].bg, color: FACE_COLORS['D'].text }"
                @click="openSticker('D', sIdx)"
              >
                <template v-if="getStickerDisplay(`D${sIdx}`).isPrimary">
                  <span :class="['text-[9px] font-black uppercase px-1 py-0.5 rounded leading-none', getStickerDisplay(`D${sIdx}`).badgeClass]">
                    BUF
                  </span>
                </template>
                <template v-else>
                  <span>{{ getStickerDisplay(`D${sIdx}`).label }}</span>
                </template>
                <span class="text-[8px] opacity-70 font-sans">D{{ sIdx }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- VISTA 3D: Cubo interactivo con rotación por arrastre y presets -->
      <div v-else class="flex flex-col items-center pb-6">
        <Cube3D
          :scheme="schemeStore.currentScheme"
          @select-sticker="openSticker"
        />
      </div>
    </div>

    <!-- Modal para editar sticker -->
    <AppModal
      v-model="showStickerModal"
      :title="`Sticker ${selectedSticker?.id}`"
      :subtitle="selectedSticker?.isBuffer ? 'Pieza asignada como Buffer' : 'Modifica la letra asignada o define como buffer'"
    >
      <div v-if="selectedSticker" class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <AppBadge :variant="selectedSticker.type === 'corner' ? 'accent' : selectedSticker.type === 'edge' ? 'primary' : 'neutral'">
            Tipo: {{ selectedSticker.type === 'corner' ? 'Esquina' : selectedSticker.type === 'edge' ? 'Arista' : 'Centro' }}
          </AppBadge>
          <AppBadge variant="neutral">
            Cara: {{ FACE_COLORS[selectedSticker.face].name }}
          </AppBadge>
          <AppBadge v-if="selectedSticker.pieceName" variant="neutral">
            Pieza: {{ selectedSticker.pieceName }}
          </AppBadge>
        </div>

        <!-- Si ES una pieza de Buffer -->
        <div v-if="selectedSticker.isBuffer" class="bg-dark-900/90 border border-dark-700/80 rounded-2xl p-4 flex flex-col gap-3">
          <div class="flex items-center gap-2">
            <AppIcon
              name="lucide:anchor"
              :size="18"
              :class-name="selectedSticker.bufferType === 'corner' ? 'text-purple-400' : 'text-indigo-400'"
            />
            <span class="font-bold text-sm text-slate-100">
              Pieza Buffer de {{ selectedSticker.bufferType === 'corner' ? 'Esquinas' : 'Aristas' }}
            </span>
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">
            En BLD, la pieza del buffer
            <strong class="text-white">
              ({{ selectedSticker.bufferType === 'corner' ? 'sus 3 caras' : 'su buffer y contraparte' }})
            </strong>
            queda sin letra porque es el punto de inicio del ciclo y nunca se memoriza como objetivo.
          </p>

          <div class="pt-2 border-t border-dark-800 flex flex-col gap-1.5">
            <span class="text-[11px] text-slate-400">Caras de esta pieza física:</span>
            <div class="flex flex-wrap items-center gap-1.5 font-mono">
              <span
                v-for="sId in selectedSticker.pieceStickers"
                :key="sId"
                :class="[
                  'px-2 py-0.5 rounded-lg text-xs font-bold border flex items-center gap-1',
                  sId === selectedSticker.id
                    ? 'bg-purple-900/40 text-purple-200 border-purple-500/50'
                    : 'bg-dark-800 text-slate-400 border-dark-700',
                ]"
              >
                {{ sId }}
                <span v-if="sId === schemeStore.currentScheme.buffers[selectedSticker.bufferType!]" class="text-[10px] text-amber-400 font-sans" title="Sticker principal">★ principal</span>
              </span>
            </div>
          </div>

          <!-- Si es contraparte/otra cara, permitir definirla como la principal de este mismo buffer -->
          <div v-if="!selectedSticker.isPrimaryBuffer" class="pt-2">
            <AppButton
              variant="secondary"
              size="sm"
              icon="lucide:arrow-right-left"
              @click="setAsBuffer(selectedSticker.bufferType!)"
            >
              Usar {{ selectedSticker.id }} como cara principal del buffer
            </AppButton>
          </div>
        </div>

        <!-- Si NO es pieza buffer: permitir asignar letra -->
        <template v-else>
          <form class="flex flex-col gap-4" @submit.prevent="saveStickerLetter">
            <AppInput
              ref="letterInputRef"
              v-model="editLetterInput"
              label="Letra Asignada"
              placeholder="Ej: A, B, C, CH..."
              clearable
              autofocus
              @enter="saveStickerLetter"
            />

            <!-- Asignar como buffer -->
            <div v-if="selectedSticker.type === 'corner' || selectedSticker.type === 'edge'" class="flex flex-col gap-2 pt-2 border-t border-dark-800">
              <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Buffer de Memo
              </span>
              <p class="text-xs text-slate-400">
                Al definirla como buffer, esta cara y
                {{ selectedSticker.type === 'corner' ? 'sus otras 2 caras asociadas' : 'su contraparte' }}
                ({{ selectedSticker.pieceStickers.join(', ') }}) quedarán automáticamente sin letra.
              </p>
              <AppButton
                v-if="selectedSticker.type === 'corner'"
                type="button"
                variant="secondary"
                size="sm"
                icon="lucide:anchor"
                @click="setAsBuffer('corner')"
              >
                Definir como Buffer de Esquinas
              </AppButton>
              <AppButton
                v-if="selectedSticker.type === 'edge'"
                type="button"
                variant="secondary"
                size="sm"
                icon="lucide:anchor"
                @click="setAsBuffer('edge')"
              >
                Definir como Buffer de Aristas
              </AppButton>
            </div>
          </form>
        </template>
      </div>

      <!-- Solo mostrar footer de acciones si es un sticker editable (no buffer) -->
      <template v-if="!selectedSticker?.isBuffer" #footer>
        <AppButton variant="ghost" size="md" @click="showStickerModal = false">
          Cancelar
        </AppButton>
        <AppButton
          variant="primary"
          size="md"
          icon="lucide:check"
          @click="saveStickerLetter"
        >
          Guardar Letra
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
