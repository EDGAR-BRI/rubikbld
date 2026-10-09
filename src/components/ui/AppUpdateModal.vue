<script setup lang="ts">
import { watch } from 'vue'
import RubikLoader from '@/components/RubikLoader.vue'
import AppIcon from './AppIcon.vue'

const props = defineProps<{
  modelValue: boolean
  statusText?: string
  detailText?: string
  currentVersion?: string
}>()

// Bloquear el scroll de la página mientras el modal/loader está activo
watch(
  () => props.modelValue,
  (val) => {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = val ? 'hidden' : ''
    }
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="update-modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-dark-950/85 backdrop-blur-md select-none touch-none"
        aria-modal="true"
        role="dialog"
      >
        <!-- Tarjeta Central de Carga de Cubos -->
        <div
          class="relative w-full max-w-sm bg-dark-900/90 border border-dark-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center gap-6 overflow-hidden"
        >
          <!-- Resplandor sutil de fondo -->
          <div
            class="absolute -top-12 -left-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"
          />
          <div
            class="absolute -bottom-12 -right-12 w-36 h-36 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"
          />

          <!-- Loader 3D del Cubo de Rubik con antifaz -->
          <div class="py-2 flex justify-center items-center">
            <RubikLoader
              :size="92"
              variant="3d"
              :blindfold="true"
            />
          </div>

          <!-- Textos de Estado Dinámicos -->
          <div class="flex flex-col items-center gap-2 max-w-xs">
            <h3 class="text-base sm:text-lg font-bold text-white tracking-wide">
              {{ statusText || 'Buscando actualizaciones...' }}
            </h3>
            <p class="text-xs sm:text-sm text-slate-400 leading-relaxed min-h-[2.5rem]">
              {{ detailText || 'Verificando la versión más reciente en el servidor...' }}
            </p>
          </div>

          <!-- Indicador de Versión Actual -->
          <div
            v-if="currentVersion"
            class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-dark-950/80 border border-dark-800 text-[11px] font-mono text-slate-400"
          >
            <AppIcon name="lucide:layers" :size="13" class="text-emerald-400 animate-spin" />
            <span>Versión instalada: <strong class="text-emerald-300 font-semibold">v{{ currentVersion }}</strong></span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.update-modal-enter-active {
  transition: opacity 0.3s ease-out;
}
.update-modal-leave-active {
  transition: opacity 0.25s ease-in;
}

.update-modal-enter-from,
.update-modal-leave-to {
  opacity: 0;
}

.update-modal-enter-active > div {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out;
}
.update-modal-leave-active > div {
  transition: transform 0.22s ease-in, opacity 0.22s ease-in;
}

.update-modal-enter-from > div {
  opacity: 0;
  transform: scale(0.92) translateY(12px);
}
.update-modal-leave-to > div {
  opacity: 0;
  transform: scale(0.95) translateY(8px);
}
</style>
