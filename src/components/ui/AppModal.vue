<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AppIcon from './AppIcon.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    title?: string
    subtitle?: string
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
    showClose?: boolean
  }>(),
  {
    title: '',
    subtitle: '',
    maxWidth: 'md',
    showClose: true,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'close'): void
}>()

// Mantiene el contenedor teleportado en el DOM mientras la animación de salida termina
const isMounted = ref(false)

// Drag-to-dismiss gesture para móvil (estilo native bottom sheet)
const dragTranslateY = ref(0)
const isDragging = ref(false)
let touchStartY = 0
let touchLastY = 0
let touchStartTime = 0

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) {
    close()
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      isMounted.value = true
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  },
  { immediate: true },
)

function onAfterLeave() {
  if (!props.modelValue) {
    isMounted.value = false
    dragTranslateY.value = 0
    isDragging.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown)
  document.body.style.overflow = ''
})

const maxWidthClasses = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
}

// Control táctil para deslizar hacia abajo en móviles
function onTouchStart(e: TouchEvent) {
  const target = e.target as HTMLElement | null
  if (target?.closest('button, a, input, select, textarea')) return
  if (e.touches.length !== 1) return

  touchStartY = e.touches[0].clientY
  touchLastY = touchStartY
  touchStartTime = Date.now()
  isDragging.value = true
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value) return
  const currentY = e.touches[0].clientY
  const deltaY = currentY - touchStartY

  if (deltaY > 0) {
    // Deslizando hacia abajo
    dragTranslateY.value = deltaY
  } else {
    // Resistencia elástica hacia arriba
    dragTranslateY.value = deltaY * 0.15
  }
  touchLastY = currentY
}

function onTouchEnd() {
  if (!isDragging.value) return
  isDragging.value = false

  const deltaY = dragTranslateY.value
  const elapsedTime = Date.now() - touchStartTime
  const velocity = (touchLastY - touchStartY) / Math.max(elapsedTime, 1)

  // Si se deslizó más de 80px o con suficiente velocidad hacia abajo
  if (deltaY > 80 || (deltaY > 30 && velocity > 0.4)) {
    close()
  } else {
    // Retorno suave si no superó el umbral
    dragTranslateY.value = 0
  }
}

const sheetStyle = computed(() => {
  if (dragTranslateY.value !== 0) {
    return {
      transform: `translate3d(0, ${Math.max(0, dragTranslateY.value)}px, 0)`,
      transition: isDragging.value
        ? 'none'
        : 'transform 0.36s cubic-bezier(0.16, 1, 0.3, 1)',
    }
  }
  return undefined
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isMounted"
      class="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 overflow-hidden pointer-events-none"
    >
      <!-- Backdrop oscuro con blur independiente -->
      <Transition name="backdrop" appear>
        <div
          v-if="modelValue"
          class="fixed inset-0 bg-black/75 backdrop-blur-sm pointer-events-auto"
          aria-hidden="true"
          @click="close"
        />
      </Transition>

      <!-- Modal Card / Native Bottom Sheet móvil (sube desde 100vh completo) -->
      <Transition name="bottom-sheet" appear @after-leave="onAfterLeave">
        <div
          v-if="modelValue"
          :class="[
            'relative w-full bg-dark-900 border-t sm:border border-dark-700/80 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] pointer-events-auto will-change-transform',
            maxWidthClasses[maxWidth],
          ]"
          :style="sheetStyle"
        >
          <!-- Mobile drag handle indicator con soporte táctil nativo -->
          <div
            class="sm:hidden w-full flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none select-none"
            title="Desliza hacia abajo para cerrar"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
            @click="close"
          >
            <div class="w-12 h-1.5 bg-dark-700 hover:bg-dark-600 rounded-full transition-colors active:scale-95" />
          </div>

          <!-- Header con soporte de arrastre en móvil -->
          <div
            class="px-5 py-3.5 sm:py-4 border-b border-dark-800 flex items-center justify-between gap-3 select-none touch-none"
            @touchstart="onTouchStart"
            @touchmove="onTouchMove"
            @touchend="onTouchEnd"
            @touchcancel="onTouchEnd"
          >
            <div class="min-w-0 pr-2 flex-1">
              <h3 v-if="title" class="text-base font-bold text-white flex items-center gap-2 truncate">
                {{ title }}
              </h3>
              <p v-if="subtitle" class="text-xs text-slate-400 mt-0.5 truncate sm:whitespace-normal">
                {{ subtitle }}
              </p>
            </div>

            <button
              v-if="showClose"
              type="button"
              aria-label="Cerrar modal"
              class="w-9 h-9 shrink-0 flex items-center justify-center text-slate-400 hover:text-white rounded-xl bg-dark-800/60 hover:bg-dark-700 active:scale-95 transition-all cursor-pointer"
              @click.stop.prevent="close"
            >
              <AppIcon name="lucide:x" :size="20" />
            </button>
          </div>

          <!-- Body -->
          <div
            class="px-5 py-4 overflow-y-auto overscroll-contain flex-1"
            :style="!$slots.footer ? { paddingBottom: 'max(1.5rem, calc(1rem + env(safe-area-inset-bottom, 0px)))' } : undefined"
          >
            <slot />
          </div>

          <!-- Footer -->
          <div
            v-if="$slots.footer"
            class="px-5 pt-3.5 pb-6 sm:pb-4.5 bg-dark-950/80 border-t border-dark-800 flex items-center justify-end gap-3 shrink-0"
            style="padding-bottom: max(1.5rem, calc(1rem + env(safe-area-inset-bottom, 0px)));"
          >
            <slot name="footer" />
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>
