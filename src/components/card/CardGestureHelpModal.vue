<script setup lang="ts">
import AppModal from '@/components/ui/AppModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <AppModal
    :model-value="modelValue"
    title="Gestos Móviles de Repaso"
    subtitle="Califica tarjetas rápidamente con 1 solo dedo (el pulgar)"
    max-width="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="flex flex-col gap-5 text-sm select-none py-1">
      <!-- Explicación breve -->
      <p class="text-xs text-slate-300 leading-relaxed">
        Arrastra la tarjeta con <strong>1 solo dedo</strong> hacia cualquiera de las cuatro direcciones para calificarla al instante, con respuesta táctil y ayuda visual en tiempo real tipo Gmail:
      </p>

      <!-- Diagrama visual interactivo de la tarjeta y los 4 gestos -->
      <div class="relative w-full max-w-xs mx-auto py-4 px-2 flex flex-col items-center">
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
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
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
          Al arrastrar la tarjeta, verás un indicador emergente que te muestra la calificación e intervalo. ¡Solo suelta para confirmar!
        </span>
      </div>
    </div>

    <template #footer>
      <AppButton variant="primary" size="md" class="w-full sm:w-auto font-semibold" @click="close">
        ¡Entendido!
      </AppButton>
    </template>
  </AppModal>
</template>
