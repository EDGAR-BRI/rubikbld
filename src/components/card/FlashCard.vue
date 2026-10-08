<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { PairItem } from '@/models/pair'
import type { SRSCard } from '@/models/card'
import AppBadge from '@/components/ui/AppBadge.vue'
import AppIcon from '@/components/ui/AppIcon.vue'

const props = withDefaults(
  defineProps<{
    pair: PairItem
    card: SRSCard
    isFlipped: boolean
    reverseMode?: boolean
  }>(),
  {
    reverseMode: false,
  },
)

const emit = defineEmits<{
  (e: 'flip'): void
  (e: 'edit', pair: PairItem): void
}>()

function onCardClick() {
  if (!props.isFlipped) {
    emit('flip')
  }
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
  <div class="w-full max-w-sm mx-auto h-[380px] sm:h-[420px] perspective-1000 select-none">
    <div
      :class="[
        'relative w-full h-full transition-transform duration-500 transform-style-3d cursor-pointer rounded-3xl shadow-2xl',
        isFlipped ? 'rotate-y-180' : '',
      ]"
      @click="onCardClick"
    >
      <!-- FRONT OF THE CARD -->
      <div
        class="absolute inset-0 w-full h-full backface-hidden bg-gradient-to-br from-dark-900 to-dark-950 border border-dark-700/80 rounded-3xl p-6 flex flex-col justify-between items-center text-center shadow-xl"
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
            class="text-[11px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20"
          >
            NUEVA
          </span>
          <span
            v-else-if="card.state === 'learning' || card.state === 'relearning'"
            class="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20"
          >
            APRENDIENDO
          </span>
          <span
            v-else
            class="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"
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
              Toca o presiona [Espacio] para ver respuesta
            </p>
          </template>

          <template v-else>
            <!-- Modo Inverso: Ver imagen/palabra primero -->
            <div v-if="pair.image" class="w-40 h-40 rounded-2xl overflow-hidden mb-3 border border-dark-700">
              <img :src="pair.image" class="w-full h-full object-cover" />
            </div>
            <div class="text-3xl font-extrabold text-indigo-300">
              {{ pair.word || 'Sin palabra asignada' }}
            </div>
            <p class="text-xs text-slate-500 mt-4 tracking-wider uppercase">
              ¿Cuál es el par de letras?
            </p>
          </template>
        </div>

        <!-- Bottom hint -->
        <div class="w-full flex items-center justify-center text-slate-500 text-xs gap-1.5">
          <AppIcon name="lucide:touch-app" :size="16" />
          <span>Toca para voltear</span>
        </div>
      </div>

      <!-- BACK OF THE CARD -->
      <div
        class="absolute inset-0 w-full h-full backface-hidden rotate-y-180 bg-gradient-to-br from-dark-850 to-dark-900 border border-indigo-500/30 rounded-3xl p-5 flex flex-col justify-between items-center text-center shadow-2xl"
      >
        <!-- Top bar of back card -->
        <div class="w-full flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg">
            {{ pair.pair }}
          </span>

          <button
            type="button"
            class="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-dark-800 transition-colors"
            title="Editar palabra o imagen"
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
</template>
