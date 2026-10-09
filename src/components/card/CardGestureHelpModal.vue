<script setup lang="ts">
import { ref } from 'vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const activeTab = ref<'swipe' | 'tilt'>('swipe')

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Gestos Móviles de Repaso"
    subtitle="Califica tarjetas rápidamente con 1 mano mientras entrenas BLD"
    max-width="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="flex flex-col gap-4 text-sm select-none py-1">
      <!-- Selector de Modo (Deslizar vs Inclinar) -->
      <div class="grid grid-cols-2 gap-1.5 p-1 bg-dark-900 border border-dark-800 rounded-2xl text-xs">
        <button
          type="button"
          :class="[
            'py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all',
            activeTab === 'swipe'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-slate-400 hover:text-white',
          ]"
          @click="activeTab = 'swipe'"
        >
          <AppIcon name="lucide:hand" :size="15" />
          <span>Deslizar con Pulgar</span>
        </button>

        <button
          type="button"
          :class="[
            'py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all',
            activeTab === 'tilt'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-400 hover:text-white',
          ]"
          @click="activeTab = 'tilt'"
        >
          <AppIcon name="lucide:smartphone" :size="15" />
          <span>Inclinar el Móvil</span>
        </button>
      </div>

      <!-- PESTAÑA 1: Deslizar con el Dedo (Swipe) -->
      <template v-if="activeTab === 'swipe'">
        <p class="text-xs text-slate-300 leading-relaxed">
          Arrastra la tarjeta con <strong>1 solo dedo</strong> hacia cualquiera de las cuatro direcciones para calificarla al instante, con respuesta táctil y ayuda visual en tiempo real tipo Gmail:
        </p>

        <!-- Diagrama visual interactivo de la tarjeta y los 4 gestos -->
        <div class="relative w-full max-w-xs mx-auto py-3 px-2 flex flex-col items-center">
          <!-- Arriba: FÁCIL -->
          <div class="flex flex-col items-center mb-2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold text-xs shadow-md shadow-sky-500/10">
              <AppIcon name="lucide:arrow-up" :size="14" />
              <span>ARRIBA: Fácil</span>
              <AppIcon name="lucide:zap" :size="13" class="text-sky-400" />
            </div>
          </div>

          <!-- Fila central: IZQUIERDA - TARJETA - DERECHA -->
          <div class="w-full flex items-center justify-between gap-2">
            <!-- Izquierda: OTRA VEZ -->
            <div class="flex flex-col items-center shrink-0">
              <div class="flex flex-col items-center gap-1 px-2.5 py-2 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs shadow-md shadow-rose-500/10">
                <AppIcon name="lucide:rotate-ccw" :size="16" class="text-rose-400" />
                <span>Otra vez</span>
                <AppIcon name="lucide:arrow-left" :size="14" />
              </div>
            </div>

            <!-- Tarjeta ilustrativa simulada -->
            <div class="flex-1 max-w-[140px] h-28 rounded-2xl bg-gradient-to-br from-dark-900 to-dark-950 border-2 border-dashed border-dark-700 flex flex-col items-center justify-center p-2 text-center shadow-xl">
              <div class="w-8 h-8 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-1">
                <AppIcon name="lucide:hand" :size="16" />
              </div>
              <span class="text-[11px] font-bold text-white">Arrastra o Toca</span>
              <span class="text-[9px] text-slate-500 mt-0.5">Toca para voltear</span>
            </div>

            <!-- Derecha: BIEN -->
            <div class="flex flex-col items-center shrink-0">
              <div class="flex flex-col items-center gap-1 px-2.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs shadow-md shadow-emerald-500/10">
                <AppIcon name="lucide:check-circle-2" :size="16" class="text-emerald-400" />
                <span>Bien</span>
                <AppIcon name="lucide:arrow-right" :size="14" />
              </div>
            </div>
          </div>

          <!-- Abajo: DIFÍCIL -->
          <div class="flex flex-col items-center mt-2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs shadow-md shadow-amber-500/10">
              <AppIcon name="lucide:arrow-down" :size="14" />
              <span>ABAJO: Difícil</span>
              <AppIcon name="lucide:flame" :size="13" class="text-amber-400" />
            </div>
          </div>
        </div>

        <!-- Tarjetas de detalle de cada acción -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
            <div class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold">
              →
            </div>
            <div>
              <p class="font-bold text-emerald-300">Derecha: Bien</p>
              <p class="text-slate-400 text-[11px] mt-0.5">Recordaste el par en tiempo normal.</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/30">
            <div class="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 font-bold">
              ←
            </div>
            <div>
              <p class="font-bold text-rose-300">Izquierda: Otra vez</p>
              <p class="text-slate-400 text-[11px] mt-0.5">Olvidado o incorrecto. Se repite pronto.</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-sky-950/20 border border-sky-900/30">
            <div class="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 font-bold">
              ↑
            </div>
            <div>
              <p class="font-bold text-sky-300">Arriba: Fácil</p>
              <p class="text-slate-400 text-[11px] mt-0.5">Recuerdo instantáneo con intervalo largo.</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-950/20 border border-amber-900/30">
            <div class="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold">
              ↓
            </div>
            <div>
              <p class="font-bold text-amber-300">Abajo: Difícil</p>
              <p class="text-slate-400 text-[11px] mt-0.5">Costó recordar. Aumenta poco el intervalo.</p>
            </div>
          </div>
        </div>

        <!-- Nota de feedback interactivo -->
        <div class="p-3 bg-dark-950/80 rounded-xl border border-dark-800 text-[11px] text-slate-400 flex items-center gap-2">
          <AppIcon name="lucide:info" :size="16" class="text-green-400 shrink-0" />
          <span>
            Al arrastrar la tarjeta, verás un indicador emergente con la calificación. ¡Solo suelta para confirmar!
          </span>
        </div>
      </template>

      <!-- PESTAÑA 2: Inclinación del Teléfono (Giroscopio Estilo Látigo) -->
      <template v-else>
        <p class="text-xs text-slate-300 leading-relaxed">
          Gesto <strong>estilo látigo</strong> con el giroscopio: Voltea la tarjeta primero y realiza un giro rápido y seco con la muñeca para calificar al instante:
        </p>

        <!-- Diagrama visual de latigazo -->
        <div class="relative w-full max-w-xs mx-auto py-3 px-2 flex flex-col items-center">
          <!-- Arriba: FÁCIL (Latigazo adelante) -->
          <div class="flex flex-col items-center mb-2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold text-xs shadow-md shadow-sky-500/10">
              <span>⬆️ Latigazo Adelante: Fácil</span>
              <AppIcon name="lucide:zap" :size="13" class="text-sky-400" />
            </div>
          </div>

          <!-- Fila central: LATIGAZO IZQ - MÓVIL - LATIGAZO DER -->
          <div class="w-full flex items-center justify-between gap-2">
            <!-- Izquierda: OTRA VEZ -->
            <div class="flex flex-col items-center shrink-0">
              <div class="flex flex-col items-center gap-1 px-2.5 py-2 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs shadow-md shadow-rose-500/10">
                <AppIcon name="lucide:rotate-ccw" :size="16" class="text-rose-400" />
                <span>← Izquierda</span>
                <span class="text-[9px] text-rose-300/80">Otra vez</span>
              </div>
            </div>

            <!-- Móvil simulado con giroscopio látigo -->
            <div class="flex-1 max-w-[140px] h-28 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-dark-950 border-2 border-emerald-500/30 flex flex-col items-center justify-center p-2 text-center shadow-xl">
              <div class="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-1">
                <AppIcon name="lucide:zap" :size="20" class="text-emerald-400 animate-pulse" />
              </div>
              <span class="text-[11px] font-bold text-emerald-300">Giro Látigo</span>
              <span class="text-[9px] text-slate-400 mt-0.5">Rápido y seco</span>
            </div>

            <!-- Derecha: BIEN -->
            <div class="flex flex-col items-center shrink-0">
              <div class="flex flex-col items-center gap-1 px-2.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs shadow-md shadow-emerald-500/10">
                <AppIcon name="lucide:check-circle-2" :size="16" class="text-emerald-400" />
                <span>Derecha →</span>
                <span class="text-[9px] text-emerald-300/80">Bien</span>
              </div>
            </div>
          </div>

          <!-- Abajo: DIFÍCIL (Latigazo hacia ti) -->
          <div class="flex flex-col items-center mt-2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs shadow-md shadow-amber-500/10">
              <span>⬇️ Hacia ti: Difícil</span>
              <AppIcon name="lucide:flame" :size="13" class="text-amber-400" />
            </div>
          </div>
        </div>

        <!-- Tarjetas de detalle de latigazo -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-emerald-950/20 border border-emerald-900/30">
            <div class="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold">
              ⚡→
            </div>
            <div>
              <p class="font-bold text-emerald-300">Derecha: Bien</p>
              <p class="text-slate-400 text-[11px] mt-0.5">Latigazo rápido a la derecha.</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/30">
            <div class="w-6 h-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 font-bold">
              ←⚡
            </div>
            <div>
              <p class="font-bold text-rose-300">Izquierda: Otra vez</p>
              <p class="text-slate-400 text-[11px] mt-0.5">Latigazo rápido a la izquierda.</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-sky-950/20 border border-sky-900/30">
            <div class="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 font-bold">
              ⬆️⚡
            </div>
            <div>
              <p class="font-bold text-sky-300">Adelante: Fácil</p>
              <p class="text-slate-400 text-[11px] mt-0.5">Latigazo del tope hacia adelante.</p>
            </div>
          </div>

          <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-amber-950/20 border border-amber-900/30">
            <div class="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold">
              ⬇️⚡
            </div>
            <div>
              <p class="font-bold text-amber-300">Hacia Ti: Difícil</p>
              <p class="text-slate-400 text-[11px] mt-0.5">Latigazo rápido hacia tu cara.</p>
            </div>
          </div>
        </div>

        <!-- Precaución y modo de uso seguro -->
        <div class="p-3 bg-dark-950/80 rounded-xl border border-dark-800 text-[11px] text-slate-400 flex flex-col gap-1.5">
          <div class="flex items-center gap-1.5 font-bold text-emerald-400">
            <AppIcon name="lucide:shield-check" :size="14" />
            <span>Seguridad Anti-Salto de Tarjetas</span>
          </div>
          <p>
            El giroscopio <strong>solo se activa tras voltear la tarjeta</strong>. Así tienes tiempo de ver el par de letras con total calma y es imposible que dos tarjetas pasen de golpe. Voltea con un toque, y luego haz el latigazo para calificar.
          </p>
        </div>
      </template>
    </div>

    <template #footer>
      <AppButton variant="primary" size="md" class="w-full sm:w-auto font-semibold" @click="close">
        ¡Entendido!
      </AppButton>
    </template>
  </AppModal>
</template>
